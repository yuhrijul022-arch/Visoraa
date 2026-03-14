import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from '../_lib/db.js';
import { payments } from '../../src/db/schema/payments.js';
import { eq, and, desc } from 'drizzle-orm';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing auth token' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid auth token' });
        }

        const uid = user.id;

        // Query Drizzle for the latest VALID pending payment for this user
        // Only status='pending' is selected (excludes paid, failed, expired, refunded by design)
        const latestPending = await db
            .select()
            .from(payments)
            .where(
                and(
                    eq(payments.userId, uid),
                    eq(payments.status, 'pending')
                )
            )
            .orderBy(desc(payments.createdAt))
            .limit(1);

        if (latestPending.length === 0) {
            return res.status(200).json({ hasPending: false });
        }

        const payment = latestPending[0];

        // Safety: skip records older than 24 hours as they are likely stale/expired
        if (payment.createdAt) {
            const ageMs = Date.now() - new Date(payment.createdAt).getTime();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            if (ageMs > TWENTY_FOUR_HOURS) {
                return res.status(200).json({ hasPending: false });
            }
        }
        const gatewayResponse = payment.gatewayResponse as Record<string, any> || {};

        return res.status(200).json({
            hasPending: true,
            orderId: payment.orderId,
            amount: payment.amountIdr,
            gateway: payment.gateway,
            redirectUrl: gatewayResponse.redirectUrl || null,
            snapToken: gatewayResponse.snapToken || null,
            planType: payment.planType || 'basic',
        });

    } catch (err: any) {
        console.error('Error fetching latest pending payment:', err);
        return res.status(500).json({ error: 'Failed to fetch pending payment status.' });
    }
}
