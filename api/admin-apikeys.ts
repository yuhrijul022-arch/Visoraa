import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema/users';
import { apiKeys } from '../src/db/schema/apiKeys';

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
                
                // Set others of same provider to inactive
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
    } catch (err) {
        console.error('API Keys admin error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
