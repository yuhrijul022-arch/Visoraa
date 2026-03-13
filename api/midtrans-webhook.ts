import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db';
import { payments } from '../src/db/schema/payments';
import { getActiveProvider } from './_lib/payment/factory';
import { MidtransProvider } from './_lib/payment/midtrans';
import { fulfillPayment } from './_lib/payment/fulfill';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    try {
        if (!supabase) {
            console.error('Webhook: Missing Supabase config');
            return res.status(200).send('OK: Missing Config');
        }

        const notification = req.body;
        if (!notification?.order_id) return res.status(200).send('OK: Ignored');

        const {
            order_id: rawOrderId,
            transaction_status: transactionStatus,
            fraud_status: fraudStatus,
            gross_amount: grossAmountRaw,
            status_code: statusCode,
            signature_key: signatureKey,
        } = notification;

        console.log('Webhook received:', { orderId: rawOrderId, status: transactionStatus });

        // Instantiate MidtransProvider for legacy and modern verification
        const midtransProvider = new MidtransProvider();
        const isValidSignature = await midtransProvider.verifyWebhook(notification, signatureKey);

        if (!isValidSignature) {
            console.error('Webhook: signature mismatch', { orderId: rawOrderId });
            return res.status(401).send('Unauthorized');
        }

        const parts = rawOrderId.split('-');
        if (parts.length < 3) return res.status(200).send('OK: Invalid format');

        const app = parts[0]; // VIS, FLG, SPK
        const type = parts[1]; // SIGNUP, TOPUP
        
        // Determine outcome
        let isSuccess = false;
        let finalStatus = transactionStatus;
        if (transactionStatus === 'capture' && fraudStatus === 'accept') isSuccess = true;
        else if (transactionStatus === 'settlement') isSuccess = true;
        else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) finalStatus = 'failed';

        // Check if there is an existing new Drizzle 'payments' record
        const drizzlePayment = await db.query.payments.findFirst({
            where: eq(payments.orderId, rawOrderId),
        });

        if (drizzlePayment) {
            // ============================================ //
            // NEW SYSTEM (Visora v2.0 Drizzle Logic)       //
            // ============================================ //
            if (isSuccess || statusCode === '200') {
                await fulfillPayment(rawOrderId, notification);
                
                // Fire CAPI Purchase event for NEW SYSTEM
                try {
                    const userEmail = notification.customer_details?.email || '';
                    const userId = drizzlePayment.userId || '';
                    const purchaseEventId = `purchase-${rawOrderId}-${Date.now()}`;
                    const capiPayload = {
                        eventName: 'Purchase',
                        eventId: purchaseEventId,
                        email: userEmail,
                        externalId: userId,
                        value: parseInt(String(grossAmountRaw), 10),
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
                        console.log('CAPI Purchase sent: Visora v2', { orderId: rawOrderId, value: capiPayload.value });
                    }
                } catch (capiErr) {
                    console.error('CAPI Purchase error (non-blocking):', capiErr);
                }

            } else {
                const mappedStatus = finalStatus === 'pending' ? 'pending' : finalStatus === 'failed' ? 'failed' : 'expired';
                await db.update(payments).set({ status: mappedStatus, gatewayResponse: notification }).where(eq(payments.orderId, rawOrderId));
            }
            return res.status(200).send('OK');
        }

        // ============================================ //
        // LEGACY SYSTEM (Fallback for older apps)      //
        // ============================================ //
        
        if (!['FLG', 'VIS', 'SPK'].includes(app)) return res.status(200).send('OK: Unknown app');

        // 3. Find transaction
        let { data: txData } = await supabase.from('transactions').select('*').eq('order_id', rawOrderId).single();
        if (!txData) {
            const { data: newTx } = await supabase.from('transactions').insert({
                app, order_id: rawOrderId, type,
                amount: parseInt(String(grossAmountRaw), 10),
                email: notification.customer_details?.email || 'unknown@webhook.com',
                credits: type === 'SIGNUP' ? 25 : 0,
                status: 'pending', raw_notification: notification,
            } as any).select().single();
            if (!newTx) return res.status(200).send('OK');
            txData = newTx;
        }

        if (isSuccess || statusCode === '200') {
            if ((txData as any).status === 'success' || (txData as any).credited === true) {
                return res.status(200).send('OK: Already processed');
            }

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
                    id: userId, app, email: (txData as any).email,
                    username: (txData as any).username, credits: creditsToAdd,
                    pro_active: type === 'SIGNUP',
                } as never);
            }

            await supabase.from('transactions').update({
                status: 'success', credited: true,
                credited_at: new Date().toISOString(),
                user_id: userId, payment_type: notification.payment_type || null,
                raw_notification: notification,
            } as never).eq('order_id', rawOrderId);

            await supabase.from('processed_notifications').insert({
                order_id: rawOrderId, transaction_id: (txData as any).id, payload: notification,
            } as any);

            // Legacy CAPI Phase
            try {
                const userEmail = (txData as any).email || notification.customer_details?.email || '';
                const purchaseEventId = `purchase-${rawOrderId}-${Date.now()}`;
                const capiPayload = {
                    eventName: 'Purchase', eventId: purchaseEventId, email: userEmail, externalId: userId,
                    value: parseInt(String(grossAmountRaw), 10), currency: 'IDR',
                    sourceUrl: `${process.env.VITE_SITE_URL || 'https://visoraa.vercel.app'}/formorder`,
                };
                const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '988932959615649';
                const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

                if (META_CAPI_TOKEN) {
                    const hashedEmail = createHash('sha256').update(userEmail.trim().toLowerCase()).digest('hex');
                    const hashedUserId = createHash('sha256').update(userId).digest('hex');
                    const capiData = {
                        data: [{
                            event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: purchaseEventId,
                            event_source_url: capiPayload.sourceUrl, action_source: 'website',
                            user_data: { em: [hashedEmail], external_id: [hashedUserId] },
                            custom_data: { currency: 'IDR', value: capiPayload.value },
                        }],
                    };
                    await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capiData),
                    });
                }
            } catch (capiErr) {
                console.error('CAPI Legacy Purchase error (non-blocking):', capiErr);
            }

        } else {
            const mappedStatus = finalStatus === 'pending' ? 'pending' : finalStatus === 'failed' ? 'failed' : 'expired';
            await supabase.from('transactions').update({ status: mappedStatus, raw_notification: notification } as never).eq('order_id', rawOrderId);
        }

        return res.status(200).send('OK');

    } catch (err: any) {
        console.error('Webhook global error:', err);
        return res.status(200).send('OK: Error logged');
    }
}
