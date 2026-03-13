import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db';
import { infiniteUsage } from '../src/db/schema/index';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    
    // Authorization
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        await db.update(infiniteUsage).set({ dailyCount: 0, dailyResetAt: new Date() });
        return res.status(200).json({ success: true, message: 'Daily counts reset successfully' });
    } catch (e: any) {
        console.error('Reset Cron Error:', e);
        return res.status(500).json({ error: e.message });
    }
}
