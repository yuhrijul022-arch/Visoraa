import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq, desc } from 'drizzle-orm';
import { db } from '../_lib/db.js';
import { payments, users } from '../../src/db/schema/index.js';
import { getActiveProvider } from '../_lib/payment/factory.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const CREDIT_PRICE = 195;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        let user: any = null;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user: authUser } } = await supabase.auth.getUser(token);
            user = authUser;
        }

        // ==========================================
        // ACTION: GET USER PAYMENTS (replace user-payments.ts)
        // ==========================================
        if (req.method === 'GET') {
            if (!user) return res.status(401).json({ error: 'Invalid auth token' });
            
            const userPayments = await db.query.payments.findMany({
                where: eq(payments.userId, user.id),
                orderBy: [desc(payments.createdAt)],
                limit: 50
            });

            const mapped = userPayments.map((p: any) => {
                const gw = p.gatewayResponse as Record<string, any> | null;
                return {
                    id: p.id, orderId: p.orderId, type: p.type, planType: p.planType,
                    creditsAmount: p.creditsAmount, amountIdr: p.amountIdr, status: p.status,
                    createdAt: p.createdAt, gateway: p.gateway, snapToken: gw?.snapToken || null,
                    redirectUrl: gw?.redirectUrl || null
                };
            });
            return res.status(200).json(mapped);
        }

        // ==========================================
        // ACTION: POST CREATE/TOPUP PAYMENTS 
        // ==========================================
        if (req.method === 'POST') {
            const { action } = req.query;

            // --- TOPUP LOGIC ---
            if (action === 'topup') {
                if (!user) return res.status(401).json({ error: 'Invalid auth token' });
                const uid = user.id;

                const dbUser = await db.query.users.findFirst({ where: eq(users.id, uid) });
                if (dbUser && dbUser.status !== 'active') return res.status(403).json({ error: 'Account is not active and cannot create payments.' });

                const { creditsQty, amount } = req.body;
                const totalPrice = amount || (creditsQty * CREDIT_PRICE);
                const finalCreditsQty = creditsQty || Math.ceil(totalPrice / CREDIT_PRICE);

                if (!finalCreditsQty || finalCreditsQty < 1) return res.status(400).json({ error: 'Minimum 1 credit.' });
                if (totalPrice < 10000) return res.status(400).json({ error: 'Minimal top-up Rp 10.000' });

                const email = user.email || 'unknown@visora.com';
                const username = user.user_metadata?.full_name || 'Visora User';
                const orderId = `VIS-TOPUP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
                const provider = await getActiveProvider();
                const gatewayName = process.env.ACTIVE_GATEWAY === 'mayar' ? 'mayar' : 'midtrans';

                const result = await provider.createTransaction({ userId: uid, orderId, email, name: username, amountIdr: totalPrice, paymentType: 'topup', creditsQty: finalCreditsQty });

                await db.insert(payments).values({
                    userId: uid, orderId, gateway: gatewayName, type: 'topup', creditsAmount: finalCreditsQty,
                    amountIdr: totalPrice, status: 'pending', gatewayResponse: { snapToken: result.token, redirectUrl: result.redirectUrl }
                });

                await db.insert(users).values({ id: uid, email, name: username, credits: 0 }).onConflictDoNothing();

                return res.status(200).json({
                    snapToken: result.token, token: result.token, orderId, totalPrice, gateway: gatewayName,
                    redirectUrl: result.redirectUrl, clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY,
                    isProduction: process.env.MIDTRANS_IS_PROD === 'true',
                });
            }

            // --- CREATE TRANSACTION LOGIC (Sign Up/Plan) ---
            const { email, username, password, whatsapp, promoCode, planType = 'basic', paymentType = 'plan' } = req.body;
            let userId: string | undefined = user?.id;

            if (user) {
                const dbUser = await db.query.users.findFirst({ where: eq(users.id, userId!) });
                if (dbUser && dbUser.status !== 'active') return res.status(403).json({ error: 'Account is not active and cannot create payments.' });
                if (dbUser?.plan === 'pro' && planType === 'basic') return res.status(400).json({ error: "Downgrade tidak diperbolehkan" });
            } else {
                if (!email || !username || !password) return res.status(400).json({ error: 'Semua field wajib diisi: nama, email, password.' });
                const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: username } });
                if (signUpError) {
                    if (signUpError.message.includes('already been registered') || signUpError.message.includes('already exists')) return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
                    return res.status(400).json({ error: signUpError.message });
                }
                userId = signUpData.user?.id!;
                if (!userId) return res.status(500).json({ error: 'Failed to create user.' });
            }

            if (paymentType === 'infinite_extend' && !userId) return res.status(401).json({ error: "Unauthorized" });

            let basePrice = planType === 'pro' ? 145000 : 99000;
            let discountAmount = 0;
            let promoApplied = false;

            if (paymentType === 'infinite_extend') basePrice = 100000;
            else if (promoCode) {
                const { data: coupon } = await supabase.from('coupons').select('*').eq('code', promoCode.toUpperCase()).eq('active', true).single();
                if (coupon) {
                    const c = coupon as any;
                    if (!c.max_uses || c.current_uses < c.max_uses) {
                        discountAmount = c.discount_type === 'percentage' ? Math.floor(basePrice * (c.discount_value / 100)) : c.discount_value;
                        promoApplied = true;
                        await supabase.from('coupons').update({ current_uses: (c.current_uses || 0) + 1 } as never).eq('id', c.id);
                    }
                }
            }

            const totalPrice = Math.max(basePrice - discountAmount, 1000);
            let orderIdPrefix = paymentType === 'infinite_extend' ? 'EXTEND' : paymentType === 'topup' ? `TOPUP-${totalPrice}` : `SIGNUP-${(planType || 'BASIC').toUpperCase()}`;
            const orderId = `VIS-${orderIdPrefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

            const provider = await getActiveProvider();
            const gatewayName = process.env.ACTIVE_GATEWAY === 'mayar' ? 'mayar' : 'midtrans';

            const result = await provider.createTransaction({ userId: userId as string, orderId, email: email || 'user@visora.com', name: username || 'Visora User', amountIdr: totalPrice, paymentType: paymentType, planType: paymentType === 'plan' ? planType : undefined, redirectPath: '/pending-payment' });

            await db.insert(users).values({ id: userId, email, name: username, whatsapp: whatsapp || null, credits: 0 })
              .onConflictDoUpdate({ target: users.id, set: { whatsapp: whatsapp || null, name: username } });

            await db.insert(payments).values({ userId: userId as string, orderId, gateway: gatewayName, type: paymentType as any, planType: paymentType === 'plan' ? planType : null, amountIdr: totalPrice, status: 'pending', gatewayResponse: { redirectUrl: result.redirectUrl, snapToken: result.token } });

            return res.status(200).json({
                data: {
                    snapToken: result.token, token: result.token, orderId, totalPrice, gateway: gatewayName, redirectUrl: result.redirectUrl,
                    clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY,
                    isProduction: process.env.MIDTRANS_IS_PROD === 'true', userId, promoApplied, discountAmount,
                }
            });
        }

    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Gagal.' });
    }
}
