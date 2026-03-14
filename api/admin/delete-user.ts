import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from '../_lib/db.js';
import { users } from '../../src/db/schema/users.js';
import { eq } from 'drizzle-orm';
import { isSuperAdmin } from '../_lib/admin/adminService.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        if (!isSuperAdmin(user.email)) {
            return res.status(403).json({ error: 'Unauthorized: Super Admin strictly required.' });
        }

        const { targetUserId } = req.body;
        if (!targetUserId) return res.status(400).json({ error: 'Target user ID required' });

        // Safe Soft Delete
        await db.update(users).set({ 
            status: 'deleted',
            updatedAt: new Date()
        }).where(eq(users.id, targetUserId));

        // Optionally, invalidate Supabase sessions for this user so they are immediately logged out
        const { error: signOutError } = await supabase.auth.admin.signOut(targetUserId, 'global');
        if (signOutError) {
            console.warn(`Failed to sign out user globally:`, signOutError);
        }

        return res.status(200).json({ message: 'User safely soft-deleted.' });

    } catch (err: any) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ error: err.message });
    }
}
