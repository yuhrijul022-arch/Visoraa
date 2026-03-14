import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq, desc } from 'drizzle-orm';
import { db } from './_lib/db.js';
import { payments } from '../src/db/schema/index.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).end();
    }
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        const token = authHeader.split(' ')[1];
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        const userPayments = await db.query.payments.findMany({
            where: eq(payments.userId, user.id),
            orderBy: [desc(payments.createdAt)],
            limit: 50
        });

        // Map responses to expose safe fields for the frontend
        const mapped = userPayments.map(p => {
            const gw = p.gatewayResponse as Record<string, any> | null;
            return {
                id: p.id,
                orderId: p.orderId,
                type: p.type,
                planType: p.planType,
                creditsAmount: p.creditsAmount,
                amountIdr: p.amountIdr,
                status: p.status,
                createdAt: p.createdAt,
                gateway: p.gateway,
                snapToken: gw?.snapToken || null,
                redirectUrl: gw?.redirectUrl || null
            };
        });

        return res.status(200).json(mapped);
    } catch (err: any) {
        console.error('Fetch user payments error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
