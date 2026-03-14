import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { payments, users } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const orderId = req.query.orderId as string;
    if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
    }

    try {
        const paymentRecord = await db.query.payments.findFirst({
            where: eq(payments.orderId, orderId)
        });

        if (!paymentRecord) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const gatewayResp = paymentRecord.gatewayResponse as Record<string, any> | null;

        return res.status(200).json({
            status: paymentRecord.status,
            type: paymentRecord.type,
            amount: paymentRecord.amountIdr,
            redirectUrl: gatewayResp?.redirectUrl || null,
            snapToken: gatewayResp?.snapToken || null
        });
    } catch (err) {
        console.error('Error fetching payment status:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
