import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema/users';

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

        // Drizzle check for isAdmin
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.id)
        });

        const isAdmin = dbUser?.isAdmin || false;

        return res.status(200).json({ isAdmin });
    } catch (err) {
        console.error('Admin check error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
