import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq, sum } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema/users';
import { payments } from '../src/db/schema/payments';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

        // Calculate stats
        const usersList = await db.select().from(users);
        const totalUsers = usersList.length;

        // Sum successful payments
        const successfulPayments = await db.query.payments.findMany({
            where: eq(payments.status, 'paid')
        });

        const totalRevenue = successfulPayments.reduce((acc, p) => acc + (p.amountIdr || 0), 0);
        
        // Sum total credits
        const totalCredits = usersList.reduce((acc, u) => acc + (u.credits || 0), 0);

        // Active generated from Supabase old table if needed, or 0 for now. Phase 4 will introduce infinite usage table.
        const activeGenerates = 0;

        return res.status(200).json({
            totalUsers,
            totalRevenue,
            totalCredits,
            activeGenerates
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
