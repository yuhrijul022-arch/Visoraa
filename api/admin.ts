import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq, ilike, or } from 'drizzle-orm';
import { db } from './_lib/db';
import { users, payments, paymentGatewayConfig, apiKeys } from '../src/db/schema/index';
import { encrypt } from './_lib/payment/crypto';

// Setup Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (!supabase) return res.status(500).json({ error: 'Server config error' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth' });

        const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        
        const { action } = req.query;

        // Admin check does not require admin rights to call (returns false)
        if (action === 'check') {
             const isAdmin = dbUser?.isAdmin || false;
             return res.status(200).json({ isAdmin });
        }

        // Require admin for the rest
        if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

        switch (action) {
            case 'stats':       return await handleStats(req, res);
            case 'users':       return await handleUsers(req, res);
            case 'users-action': return await handleUsersAction(req, res);
            case 'gateways':    return await handleGateways(req, res);
            case 'apikeys':     return await handleApiKeys(req, res);
            default:            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        console.error('Admin API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleStats(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    
    const usersList = await db.select().from(users);
    const totalUsers = usersList.length;

    const successfulPayments = await db.query.payments.findMany({
        where: eq(payments.status, 'paid')
    });
    const totalRevenue = successfulPayments.reduce((acc: number, p: any) => acc + (p.amountIdr || 0), 0);
    const totalCredits = usersList.reduce((acc: number, u: any) => acc + (u.credits || 0), 0);
    const activeGenerates = 0;

    return res.status(200).json({ totalUsers, totalRevenue, totalCredits, activeGenerates });
}

async function handleUsers(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const search = req.query.search as string || "";

    let usersList;
    if (search) {
        usersList = await db.select().from(users).where(
            or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
        ).orderBy(users.createdAt);
    } else {
        usersList = await db.select().from(users).orderBy(users.createdAt).limit(100);
    }

    return res.status(200).json({ users: usersList });
}

async function handleUsersAction(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { userId, action, value } = req.body;
    if (!userId || !action) return res.status(400).json({ error: 'Missing parameters' });

    const targetUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (action === 'add_credits') {
        const amount = parseInt(value, 10);
        if (isNaN(amount)) return res.status(400).json({ error: 'Invalid credits' });
        await db.update(users).set({ credits: (targetUser.credits || 0) + amount }).where(eq(users.id, userId));
    } else if (action === 'toggle_plan') {
        const newPlan = value === 'pro' ? 'pro' : 'basic';
        await db.update(users).set({ 
            plan: newPlan,
            infiniteEnabled: newPlan === 'pro'
        }).where(eq(users.id, userId));
    } else if (action === 'delete') {
        await db.delete(users).where(eq(users.id, userId));
        if (supabase) await supabase.auth.admin.deleteUser(userId);
    } else {
        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(200).json({ success: true });
}

async function handleGateways(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const rawConfigs = await db.select().from(paymentGatewayConfig);
        const configs = rawConfigs.map(c => ({
            id: c.id,
            gateway: c.gateway,
            isActive: c.isActive,
            hasServerKey: c.serverKey !== null,
            hasWebhookSecret: c.webhookSecret !== null,
        }));
        return res.status(200).json(configs);
    }

    if (req.method === 'POST') {
        const { action, gateway, keys } = req.body;
        if (!gateway) return res.status(400).json({ error: 'Missing gateway name' });

        if (action === 'toggle') {
            await db.update(paymentGatewayConfig).set({ isActive: false });
            const existing = await db.query.paymentGatewayConfig.findFirst({ where: eq(paymentGatewayConfig.gateway, gateway) });
            if (existing) {
                await db.update(paymentGatewayConfig).set({ isActive: true }).where(eq(paymentGatewayConfig.gateway, gateway));
            } else {
                await db.insert(paymentGatewayConfig).values({ gateway, isActive: true });
            }
            return res.status(200).json({ success: true });
        } 
        else if (action === 'update_keys') {
            if (!keys) return res.status(400).json({ error: 'Missing keys' });
            
            const updatePayload: any = {};
            if (keys.serverKey) updatePayload.serverKey = encrypt(keys.serverKey);
            if (keys.webhookSecret) updatePayload.webhookSecret = encrypt(keys.webhookSecret);

            if (Object.keys(updatePayload).length > 0) {
                const existing = await db.query.paymentGatewayConfig.findFirst({ where: eq(paymentGatewayConfig.gateway, gateway) });
                if (existing) {
                    await db.update(paymentGatewayConfig).set(updatePayload).where(eq(paymentGatewayConfig.gateway, gateway));
                } else {
                    await db.insert(paymentGatewayConfig).values({ gateway, isActive: false, ...updatePayload });
                }
            }
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleApiKeys(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const keys = await db.select({
            id: apiKeys.id,
            provider: apiKeys.provider,
            name: apiKeys.name,
            isActive: apiKeys.isActive,
            createdAt: apiKeys.createdAt
        }).from(apiKeys).orderBy(apiKeys.createdAt);
        return res.status(200).json(keys);
    }

    if (req.method === 'POST') {
        const { action, name, provider, keyValue, id } = req.body;
        
        if (action === 'add') {
            if (!name || !provider || !keyValue) return res.status(400).json({ error: 'Missing parameters' });
            await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.provider, provider as any));
            await db.insert(apiKeys).values({
                provider: provider as any,
                name,
                keyValue,
                isActive: true
            });
            return res.status(200).json({ success: true });
        } 
        else if (action === 'delete') {
            if (!id) return res.status(400).json({ error: 'Missing id' });
            await db.delete(apiKeys).where(eq(apiKeys.id, id));
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
}
