import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db';
import { payments, paymentGatewayConfig } from '../src/db/schema/index';
import { decrypt } from './_lib/payment/crypto';
import { MayarProvider } from './_lib/payment/mayar';
import { fulfillPayment } from './_lib/payment/fulfill';
import { createHash } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    try {
        const signature = req.headers['mayar-signature'] as string;
        if (!signature) return res.status(401).send('Missing signature');

        const payload = req.body;
        console.log('Mayar Webhook received:', payload);

        // Fetch Mayar secret
        let secret = process.env.MAYAR_WEBHOOK_SECRET || '';
        const config = await db.query.paymentGatewayConfig.findFirst({
            where: eq(paymentGatewayConfig.gateway, "mayar"),
        });

        if (config?.webhookSecret) {
            secret = decrypt(config.webhookSecret);
        }

        if (!secret) {
            console.error('Mayar Webhook: Secret not configured');
            return res.status(500).send('Config error');
        }

        const provider = new MayarProvider({
            serverKey: process.env.MAYAR_SERVER_KEY || "",
            webhookSecret: secret
        });
        const isValid = await provider.verifyWebhook(JSON.stringify(payload), signature);

        if (!isValid) {
            console.error('Mayar Webhook: invalid signature');
            return res.status(401).send('Unauthorized');
        }

        // Handle specific event
        // Mayar typically posts events like payment.completed or invoice.paid inside data
        // For standard checkout links it might be just payment.successful
        if (payload.status === "SUCCESSFUL" || payload.status === "COMPLETED" || payload.event === "payment.success" || payload.name === "payment.created") {
            const data = payload.data || payload; // Depending on actual payload struct
            const orderId = data.reference || data.orderId || data.order_id || payload.reference;

            if (!orderId) {
                console.error("Mayar webhook: no order ID found in payload");
                return res.status(200).send("Ignored");
            }

            const paymentRecord = await db.query.payments.findFirst({
                where: eq(payments.orderId, orderId),
            });

            if (!paymentRecord) {
                return res.status(200).send('Ignored: Transaction not found');
            }

            await fulfillPayment(orderId, payload);

            // CAPI Pixel firing
            try {
                const userEmail = data.customer?.email || data.email || '';
                const userId = paymentRecord.userId || '';
                const purchaseEventId = `purchase-${orderId}-${Date.now()}`;
                const grossAmount = data.amount || paymentRecord.amountIdr;
                
                const capiPayload = {
                    eventName: 'Purchase',
                    eventId: purchaseEventId,
                    email: userEmail,
                    externalId: userId,
                    value: grossAmount,
                    currency: 'IDR',
                    sourceUrl: `${process.env.VITE_SITE_URL || 'https://visoraa.vercel.app'}/formorder`,
                };

                const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '988932959615649';
                const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

                if (META_CAPI_TOKEN) {
                    const hashedEmail = createHash('sha256').update(userEmail.trim().toLowerCase()).digest('hex');
                    const hashedUserId = createHash('sha256').update(userId).digest('hex');

                    const capiData = {
                        data: [{
                            event_name: 'Purchase',
                            event_time: Math.floor(Date.now() / 1000),
                            event_id: purchaseEventId,
                            event_source_url: capiPayload.sourceUrl,
                            action_source: 'website',
                            user_data: { em: [hashedEmail], external_id: [hashedUserId] },
                            custom_data: { currency: 'IDR', value: capiPayload.value },
                        }],
                    };

                    await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(capiData),
                    });
                    console.log('CAPI Purchase sent (Mayar): Visora v2', { orderId, value: capiPayload.value });
                }
            } catch (capiErr) {
                console.error('CAPI Purchase error (non-blocking):', capiErr);
            }
        } else {
             const orderId = payload.data?.reference || payload.reference;
             if (orderId) {
                  await db.update(payments).set({ 
                      status: 'failed', 
                      gatewayResponse: payload 
                  }).where(eq(payments.orderId, orderId));
             }
        }

        return res.status(200).send('OK');

    } catch (err: any) {
        console.error('Mayar Webhook error:', err);
        return res.status(500).send('Error');
    }
}
