import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema/users';
import { paymentGatewayConfig } from '../src/db/schema/paymentGateway';
import { encrypt } from './_lib/payment/crypto';

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
        if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

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
                // Mutual exclusivity
                await db.update(paymentGatewayConfig).set({ isActive: false });
                
                // Ensure the target gateway row exists
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
    } catch (err) {
        console.error('API Gateways admin error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
