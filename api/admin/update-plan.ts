import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setAdminEntitlement, isSuperAdmin } from '../_lib/admin/adminService.js';

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

        const { targetUserId, targetPlan, reason } = req.body;
        if (!targetUserId || !targetPlan) return res.status(400).json({ error: 'Missing required fields' });

        const result = await setAdminEntitlement(user.email!, targetUserId, targetPlan, reason || 'Manual Admin Update');

        // Force session refresh for the target user by invalidating their current session 
        // This ensures the frontend immediately requires a new fetch
        await supabase.auth.admin.signOut(targetUserId, 'global');

        return res.status(200).json(result);

    } catch (err: any) {
        console.error('Admin update entitlement error:', err);
        return res.status(500).json({ error: err.message });
    }
}
