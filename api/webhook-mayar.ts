import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db.js';
import { payments, paymentGatewayConfig } from '../src/db/schema/index.js';
import { decrypt } from './_lib/payment/crypto.js';
import { MayarProvider } from './_lib/payment/mayar.js';
import { fulfillPayment } from './_lib/payment/fulfill.js';
import { createHash } from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`\n--- [MAYAR WEBHOOK INCOMING] ---`);
    console.log(`Method: ${req.method}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));

    if (req.method === 'OPTIONS') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    try {
        const signature = (
            req.headers['x-callback-token'] || 
            req.headers['mayar-signature'] || 
            req.headers['x-mayar-signature']
        ) as string | undefined;
        
        if (!signature) {
            console.error('[Error] Missing signature header. Mayar did not send x-callback-token or mayar-signature.');
            return res.status(401).send('Missing signature');
        }

        // Read raw body for accurate HMAC computation
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        
        let payload;
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            console.error('Mayar Webhook: Invalid JSON format');
            return res.status(400).send('Bad Request');
        }
        
        console.log('Mayar Webhook payload parsed successfully.');

        // Initialize secret from ENV variables first
        let secret = process.env.MAYAR_WEBHOOK_SECRET || '';
        
        // Attempt to fetch from DB if available, wrap in try/catch to prevent 500s
        try {
            const configRow = await db.query.paymentGatewayConfig.findFirst({
                where: eq(paymentGatewayConfig.gateway, "mayar"),
            });

            if (configRow && configRow.webhookSecret) {
                try {
                    // It might be encrypted or plain text
                    secret = decrypt(configRow.webhookSecret);
                } catch (decryptErr) {
                    console.error('Mayar Webhook: Failed to decrypt secret from DB. Falling back to ENV.', decryptErr);
                    // Fallback to storing raw if decryption fails, or just stick to ENV
                    if (!secret) secret = configRow.webhookSecret;
                }
            }
        } catch (dbErr) {
            console.error('Mayar Webhook: Failed to fetch config from DB. Falling back to ENV.', dbErr);
        }

        if (!secret) {
            console.error('Mayar Webhook: Secret not configured! Both ENV and DB are empty or failed.');
            return res.status(500).send('Config error - Missing Webhook Secret');
        }

        console.log('Mayar Webhook: Using secret starting with ->', secret.substring(0, 3) + '...');

        const provider = new MayarProvider({
            serverKey: process.env.MAYAR_SERVER_KEY || "",
            webhookSecret: secret
        });
        const isValid = await provider.verifyWebhook(rawBody, signature);

        if (!isValid) {
            console.error('Mayar Webhook: Invalid signature provided! Payload:', rawBody.substring(0, 50));
            return res.status(401).send('Unauthorized');
        }

        // Handle specific event
        // Mayar typically posts events like payment.completed or invoice.paid inside data
        // For standard checkout links it might be just payment.successful
        if (payload.status === "SUCCESSFUL" || payload.status === "COMPLETED" || payload.event === "payment.success" || payload.name === "payment.created" || payload.event === "payment.received") {
            const data = payload.data || payload; // Depending on actual payload struct
            let orderId = data.reference || data.orderId || data.order_id || payload.reference;

            // If Mayar doesn't send an orderId/reference field natively, we must extract it from the productDescription we sent them.
            if (!orderId && data.productDescription) {
                // e.g. "Visora topup - Order VIS-TOPUP-1773419382120-43146"
                const match = data.productDescription.match(/Order (VIS-[A-Z0-9-]+)/);
                if (match && match[1]) {
                    orderId = match[1];
                }
            }

            console.log('Mayar Webhook processing payment for Order ID:', orderId);

            if (!orderId) {
                console.error("Mayar webhook: no order ID found in payload! Examined fields:", JSON.stringify({ reference: data.reference, desc: data.productDescription }));
                return res.status(200).send("Ignored");
            }

            const paymentRecord = await db.query.payments.findFirst({
                where: eq(payments.orderId, orderId),
            });

            if (!paymentRecord) {
                console.error('Mayar Webhook: Transaction not found in DB for order:', orderId);
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
