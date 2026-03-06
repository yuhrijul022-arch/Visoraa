import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const midtransServerKey = process.env.MIDTRANS_SERVER_KEY!;

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

        // 1. Verify signature — Midtrans sends gross_amount as "5000.00" or "5000"
        // We try BOTH formats to handle any inconsistency
        const grossRaw = String(grossAmountRaw);
        const grossInt = Math.floor(Number(grossAmountRaw)).toString();

        const makeSignature = (amount: string) => {
            const str = `${rawOrderId}${statusCode}${amount}${midtransServerKey}`;
            return createHash('sha512').update(str).digest('hex');
        };

        const sigWithRaw = makeSignature(grossRaw);
        const sigWithInt = makeSignature(grossInt);

        if (signatureKey !== sigWithRaw && signatureKey !== sigWithInt) {
            console.error('Webhook: signature mismatch', {
                orderId: rawOrderId,
                grossRaw,
                grossInt,
                statusCode,
                receivedSig: signatureKey?.substring(0, 20) + '...',
                expectedRaw: sigWithRaw.substring(0, 20) + '...',
                expectedInt: sigWithInt.substring(0, 20) + '...',
            });
            return res.status(401).send('Unauthorized');
        }

        // 2. Parse order_id
        const parts = rawOrderId.split('-');
        if (parts.length < 3) return res.status(200).send('OK: Invalid format');

        const app = parts[0]; // VIS, FLG, SPK
        const type = parts[1]; // SIGNUP, TOPUP

        if (!['FLG', 'VIS', 'SPK'].includes(app)) return res.status(200).send('OK: Unknown app');

        // 3. Find transaction
        let { data: txData } = await supabase.from('transactions').select('*').eq('order_id', rawOrderId).single();

        if (!txData) {
            console.warn('Webhook: creating placeholder tx for', rawOrderId);
            const { data: newTx } = await supabase.from('transactions').insert({
                app, order_id: rawOrderId, type,
                amount: parseInt(grossAmountStr, 10),
                email: 'unknown@webhook.com', credits: 0,
                status: 'pending', raw_notification: notification,
            } as any).select().single();
            if (!newTx) return res.status(200).send('OK');
            txData = newTx;
        }

        // Determine outcome
        let isSuccess = false;
        let finalStatus = transactionStatus;

        if (transactionStatus === 'capture' && fraudStatus === 'accept') isSuccess = true;
        else if (transactionStatus === 'settlement') isSuccess = true;
        else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) finalStatus = 'failed';

        if (isSuccess || statusCode === '200') {
            // Idempotency check
            if ((txData as any).status === 'success' || (txData as any).credited === true) {
                return res.status(200).send('OK: Already processed');
            }

            const { data: existingNotif } = await supabase.from('processed_notifications').select('id').eq('order_id', rawOrderId).single();
            if (existingNotif) return res.status(200).send('OK: Already processed');

            let userId = (txData as any).user_id;
            let creditsToAdd = (txData as any).credits || 0;

            // Fallback user resolution
            if (!userId) {
                const emailFallback = (txData as any).email || notification.customer_details?.email;
                if (emailFallback) {
                    const { data: fbUser } = await supabase.from('users').select('id').eq('email', emailFallback).single();
                    if (fbUser) userId = (fbUser as any).id;
                    else {
                        const { data: authUsers } = await supabase.auth.admin.listUsers();
                        const found = authUsers?.users?.find(u => u.email === emailFallback);
                        if (found) userId = found.id;
                    }
                }
            }

            if (!userId) {
                await supabase.from('transactions').update({ status: 'success', raw_notification: notification } as never).eq('order_id', rawOrderId);
                return res.status(200).send('OK: No user to credit');
            }

            // Get current credits
            const { data: currentUser } = await supabase.from('users').select('id, credits, pro_active').eq('id', userId).single();

            if (currentUser) {
                const updatePayload: any = { credits: ((currentUser as any).credits || 0) + creditsToAdd };
                if (type === 'SIGNUP') updatePayload.pro_active = true;
                await supabase.from('users').update(updatePayload as never).eq('id', userId);
            } else {
                await supabase.from('users').upsert({
                    id: userId, app, email: (txData as any).email,
                    username: (txData as any).username,
                    credits: creditsToAdd,
                    pro_active: type === 'SIGNUP',
                } as never);
            }

            // Update transaction
            await supabase.from('transactions').update({
                status: 'success', credited: true,
                credited_at: new Date().toISOString(),
                user_id: userId,
                payment_type: notification.payment_type || null,
                raw_notification: notification,
            } as never).eq('order_id', rawOrderId);

            // Record processed notification
            await supabase.from('processed_notifications').insert({
                order_id: rawOrderId,
                transaction_id: (txData as any).id,
                payload: notification,
            } as any);

            console.log('Credits applied:', { orderId: rawOrderId, userId, creditsToAdd, app, type });

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
