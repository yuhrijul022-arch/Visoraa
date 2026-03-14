import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db.js';
import { payments, paymentGatewayConfig } from '../src/db/schema/index.js';
import { getActiveProvider } from './_lib/payment/factory.js';
import { MidtransProvider } from './_lib/payment/midtrans.js';
import { MayarProvider } from './_lib/payment/mayar.js';
import { fulfillPayment } from './_lib/payment/fulfill.js';
import { decrypt } from './_lib/payment/crypto.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    // Mayar sends 'x-callback-token' or 'mayar-signature'
    const isMayar = Boolean(
        req.headers['x-callback-token'] || 
        req.headers['mayar-signature'] || 
        req.headers['x-mayar-signature']
    );

    if (isMayar) {
        return await mayarHandler(req, res);
    } else {
        // Assume Midtrans
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        
        let rawBody = '';
        if (chunks.length > 0) {
           rawBody = Buffer.concat(chunks).toString('utf8');
        }
        
        if (rawBody) {
             try {
                req.body = JSON.parse(rawBody);
             } catch(e) {}
        }
        
        return await midtransHandler(req, res);
    }
}

// ==========================================
// MAYAR HANDLER INLINED
// ==========================================
async function mayarHandler(req: VercelRequest, res: VercelResponse) {
    console.log(`\n--- [MAYAR WEBHOOK INCOMING] ---`);
    try {
        const signature = (
            req.headers['x-callback-token'] || 
            req.headers['mayar-signature'] || 
            req.headers['x-mayar-signature']
        ) as string | undefined;
        
        if (!signature) {
            return res.status(401).send('Missing signature');
        }

        // Read raw body again (it's safe here or use a cached version, but `req` is a stream so reading it once in parent is better for both, 
        // but `mayarHandler` doesn't get chunks. So we MUST read it here instead of parent, but parent passed `req` directly. Let's read it)
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        
        let payload;
        try { payload = JSON.parse(rawBody); } 
        catch (e) { return res.status(400).send('Bad Request'); }
        
        let secret = process.env.MAYAR_WEBHOOK_SECRET || '';
        try {
            const configRow = await db.query.paymentGatewayConfig.findFirst({
                where: eq(paymentGatewayConfig.gateway, "mayar"),
            });
            if (configRow && configRow.webhookSecret) {
                try { secret = decrypt(configRow.webhookSecret); } 
                catch (e) { if (!secret) secret = configRow.webhookSecret; }
            }
        } catch (e) {}

        if (!secret) return res.status(500).send('Config error - Missing Webhook Secret');

        const provider = new MayarProvider({ serverKey: process.env.MAYAR_SERVER_KEY || "", webhookSecret: secret });
        const isValid = await provider.verifyWebhook(rawBody, signature);
        if (!isValid) return res.status(401).send('Unauthorized');

        if (payload.status === "SUCCESSFUL" || payload.status === "COMPLETED" || payload.event === "payment.success" || payload.name === "payment.created" || payload.event === "payment.received") {
            const data = payload.data || payload; 
            let orderId = data.reference || data.orderId || data.order_id || payload.reference;

            if (!orderId && data.productDescription) {
                const match = data.productDescription.match(/Order (VIS-[A-Z0-9-]+)/);
                if (match && match[1]) orderId = match[1];
            }

            if (!orderId) return res.status(200).send("Ignored");

            const paymentRecord = await db.query.payments.findFirst({ where: eq(payments.orderId, orderId) });
            if (!paymentRecord) return res.status(200).send('Ignored: Transaction not found');

            await fulfillPayment(orderId, payload);

            try {
                const purchaseEventId = `purchase-${orderId}-${Date.now()}`;
                const capiPayload = {
                    eventName: 'Purchase', eventId: purchaseEventId,
                    email: data.customer?.email || data.email || '', externalId: paymentRecord.userId || '',
                    value: data.amount || paymentRecord.amountIdr, currency: 'IDR',
                    sourceUrl: `${process.env.VITE_SITE_URL || 'https://visoraa.vercel.app'}/formorder`,
                };

                const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '';
                const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

                if (META_CAPI_TOKEN && META_PIXEL_ID) {
                    const hashedEmail = createHash('sha256').update(capiPayload.email.trim().toLowerCase()).digest('hex');
                    const hashedUserId = createHash('sha256').update(capiPayload.externalId).digest('hex');
                    const capiData = {
                        data: [{
                            event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: purchaseEventId,
                            event_source_url: capiPayload.sourceUrl, action_source: 'website',
                            user_data: { em: [hashedEmail], external_id: [hashedUserId] },
                            custom_data: { currency: 'IDR', value: capiPayload.value },
                        }], test_event_code: 'TEST31173'
                    };
                    await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capiData),
                    });
                }
            } catch (e) {}
        } else {
             const orderId = payload.data?.reference || payload.reference;
             if (orderId) {
                  await db.update(payments).set({ status: 'failed', gatewayResponse: payload }).where(eq(payments.orderId, orderId));
             }
        }
        return res.status(200).send('OK');
    } catch (err: any) {
        return res.status(500).send('Error');
    }
}

// ==========================================
// MIDTRANS HANDLER INLINED
// ==========================================
async function midtransHandler(req: VercelRequest, res: VercelResponse) {
    try {
        if (!supabase) return res.status(200).send('OK: Missing Config');

        const notification = req.body;
        if (!notification?.order_id) return res.status(200).send('OK: Ignored');

        const {
            order_id: rawOrderId, transaction_status: transactionStatus, fraud_status: fraudStatus,
            gross_amount: grossAmountRaw, status_code: statusCode, signature_key: signatureKey,
        } = notification;

        const midtransProvider = new MidtransProvider({
            serverKey: process.env.MIDTRANS_SERVER_KEY_PROD || process.env.MIDTRANS_SERVER_KEY_SANDBOX || process.env.MIDTRANS_SERVER_KEY!,
            clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY!
        });
        const isValidSignature = await midtransProvider.verifyWebhook(notification, signatureKey);

        if (!isValidSignature) return res.status(401).send('Unauthorized');

        const parts = rawOrderId.split('-');
        if (parts.length < 3) return res.status(200).send('OK: Invalid format');

        const app = parts[0]; 
        const type = parts[1]; 
        
        let isSuccess = false;
        let finalStatus = transactionStatus;
        if (transactionStatus === 'capture' && fraudStatus === 'accept') isSuccess = true;
        else if (transactionStatus === 'settlement') isSuccess = true;
        else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) finalStatus = 'failed';

        const drizzlePayment = await db.query.payments.findFirst({ where: eq(payments.orderId, rawOrderId) });

        if (drizzlePayment) {
            // NEW SYSTEM
            if (isSuccess || statusCode === '200') {
                await fulfillPayment(rawOrderId, notification);
                try {
                    const purchaseEventId = `purchase-${rawOrderId}-${Date.now()}`;
                    const capiPayload = {
                        eventName: 'Purchase', eventId: purchaseEventId,
                        email: notification.customer_details?.email || '', externalId: drizzlePayment.userId || '',
                        value: parseInt(String(grossAmountRaw), 10), currency: 'IDR',
                        sourceUrl: `${process.env.VITE_SITE_URL || 'https://visoraa.vercel.app'}/formorder`,
                    };

                    const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '';
                    const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

                    if (META_CAPI_TOKEN && META_PIXEL_ID) {
                        const hashedEmail = createHash('sha256').update(capiPayload.email.trim().toLowerCase()).digest('hex');
                        const hashedUserId = createHash('sha256').update(capiPayload.externalId).digest('hex');
                        const capiData = {
                            data: [{
                                event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: purchaseEventId,
                                event_source_url: capiPayload.sourceUrl, action_source: 'website',
                                user_data: { em: [hashedEmail], external_id: [hashedUserId] },
                                custom_data: { currency: 'IDR', value: capiPayload.value },
                            }], test_event_code: 'TEST31173'
                        };
                        await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capiData),
                        });
                    }
                } catch (e) {}
            } else {
                const mappedStatus = finalStatus === 'pending' ? 'pending' : finalStatus === 'failed' ? 'failed' : 'expired';
                await db.update(payments).set({ status: mappedStatus, gatewayResponse: notification }).where(eq(payments.orderId, rawOrderId));
            }
            return res.status(200).send('OK');
        }

        // LEGACY SYSTEM
        if (!['FLG', 'VIS', 'SPK'].includes(app)) return res.status(200).send('OK: Unknown app');

        let { data: txData } = await supabase.from('transactions').select('*').eq('order_id', rawOrderId).single();
        if (!txData) {
            const { data: newTx } = await supabase.from('transactions').insert({
                app, order_id: rawOrderId, type, amount: parseInt(String(grossAmountRaw), 10),
                email: notification.customer_details?.email || 'unknown@webhook.com', credits: type === 'SIGNUP' ? 25 : 0,
                status: 'pending', raw_notification: notification,
            } as any).select().single();
            if (!newTx) return res.status(200).send('OK');
            txData = newTx;
        }

        if (isSuccess || statusCode === '200') {
            if ((txData as any).status === 'success' || (txData as any).credited === true) return res.status(200).send('OK: Already processed');
            const { data: existingNotif } = await supabase.from('processed_notifications').select('id').eq('order_id', rawOrderId).single();
            if (existingNotif) return res.status(200).send('OK: Already processed');

            let userId = (txData as any).user_id;
            let creditsToAdd = (txData as any).credits || 0;
            if (type === 'SIGNUP' && creditsToAdd === 0) creditsToAdd = 25;

            if (!userId) {
                const emailFallback = (txData as any).email || notification.customer_details?.email;
                if (emailFallback) {
                    const { data: fbUser } = await supabase.from('users').select('id').eq('email', emailFallback).single();
                    if (fbUser) userId = (fbUser as any).id;
                }
            }

            if (!userId) {
                await supabase.from('transactions').update({ status: 'success', raw_notification: notification } as never).eq('order_id', rawOrderId);
                return res.status(200).send('OK: No user to credit');
            }

            const { data: currentUser } = await supabase.from('users').select('id, credits, pro_active').eq('id', userId).single();
            if (currentUser) {
                const updatePayload: any = { credits: ((currentUser as any).credits || 0) + creditsToAdd };
                if (type === 'SIGNUP') updatePayload.pro_active = true;
                await supabase.from('users').update(updatePayload as never).eq('id', userId);
            } else {
                await supabase.from('users').upsert({
                    id: userId, app, email: (txData as any).email, username: (txData as any).username, 
                    credits: creditsToAdd, pro_active: type === 'SIGNUP',
                } as never);
            }

            await supabase.from('transactions').update({
                status: 'success', credited: true, credited_at: new Date().toISOString(), user_id: userId, 
                payment_type: notification.payment_type || null, raw_notification: notification,
            } as never).eq('order_id', rawOrderId);

            await supabase.from('processed_notifications').insert({ order_id: rawOrderId, transaction_id: (txData as any).id, payload: notification } as any);

            try {
                const purchaseEventId = `purchase-${rawOrderId}-${Date.now()}`;
                const capiPayload = {
                    eventName: 'Purchase', eventId: purchaseEventId,
                    email: (txData as any).email || notification.customer_details?.email || '', externalId: userId,
                    value: parseInt(String(grossAmountRaw), 10), currency: 'IDR',
                    sourceUrl: `${process.env.VITE_SITE_URL || 'https://visoraa.vercel.app'}/formorder`,
                };
                const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '';
                const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

                if (META_CAPI_TOKEN && META_PIXEL_ID) {
                    const hashedEmail = createHash('sha256').update(capiPayload.email.trim().toLowerCase()).digest('hex');
                    const hashedUserId = createHash('sha256').update(userId).digest('hex');
                    const capiData = {
                        data: [{
                            event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: purchaseEventId,
                            event_source_url: capiPayload.sourceUrl, action_source: 'website',
                            user_data: { em: [hashedEmail], external_id: [hashedUserId] },
                            custom_data: { currency: 'IDR', value: capiPayload.value },
                        }], test_event_code: 'TEST31173'
                    };
                    await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capiData),
                    });
                }
            } catch (e) {}

        } else {
            const mappedStatus = finalStatus === 'pending' ? 'pending' : finalStatus === 'failed' ? 'failed' : 'expired';
            await supabase.from('transactions').update({ status: mappedStatus, raw_notification: notification } as never).eq('order_id', rawOrderId);
        }
        return res.status(200).send('OK');
    } catch (err: any) {
        return res.status(200).send('OK: Error logged');
    }
}
