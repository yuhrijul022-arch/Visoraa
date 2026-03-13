import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema/users';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server config error' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth' });

        const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

        const { userId, action, value } = req.body;
        if (!userId || !action) return res.status(400).json({ error: 'Missing parameters' });

        const targetUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        if (action === 'add_credits') {
            const amount = parseInt(value, 10);
            if (isNaN(amount)) return res.status(400).json({ error: 'Invalid credits' });
            await db.update(users).set({ credits: targetUser.credits + amount }).where(eq(users.id, userId));
        } else if (action === 'toggle_plan') {
            const newPlan = value === 'pro' ? 'pro' : 'basic';
            await db.update(users).set({ 
                plan: newPlan,
                infiniteEnabled: newPlan === 'pro'
            }).where(eq(users.id, userId));
        } else if (action === 'delete') {
            await db.delete(users).where(eq(users.id, userId));
            // Ensure delete on Supabase Auth
            await supabase.auth.admin.deleteUser(userId);
        } else {
            return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Admin custom action error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
