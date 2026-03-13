import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db';
import { payments } from '../src/db/schema/payments';
import { users } from '../src/db/schema/users';
import { getActiveProvider } from './_lib/payment/factory';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const { email, username, password, promoCode, planType = 'basic', paymentType = 'plan' } = req.body;

        let userId: string | undefined;
        let authHeader = req.headers.authorization;

        // Handle Upgrade Logic (Phase 5 Prep)
        // If the user already has a bearer token, they might be logged in and just upgrading.
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                userId = user.id;
                
                // Security Check: Prevent downgrade
                const dbUser = await db.query.users.findFirst({ where: eq(users.id, userId!) });
                if (dbUser?.plan === 'pro' && planType === 'basic') {
                    return res.status(400).json({ error: "Downgrade tidak diperbolehkan" });
                }
            } else {
                return res.status(401).json({ error: 'Invalid auth token' });
            }
        } else {
            if (!email || !username || !password) {
                return res.status(400).json({ error: 'Semua field wajib diisi: nama, email, password.' });
            }

            // Create Supabase auth user if no bearer token
            const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: username },
            });

            if (signUpError) {
                if (signUpError.message.includes('already been registered') || signUpError.message.includes('already exists')) {
                    return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
                }
                console.error('Signup error:', signUpError);
                return res.status(400).json({ error: signUpError.message });
            }

            userId = signUpData.user?.id!;
            if (!userId) return res.status(500).json({ error: 'Failed to create user.' });
        }

        if (paymentType === 'infinite_extend' && !userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Pricing Dual Plan (Phase 5 Prep)
        let basePrice = planType === 'pro' ? 145000 : 99000;
        let discountAmount = 0;
        let promoApplied = false;

        if (paymentType === 'infinite_extend') {
            basePrice = 100000; // Rp100.000 extended price
        } else if (promoCode) {
            const { data: coupon } = await supabase.from('coupons').select('*').eq('code', promoCode.toUpperCase()).eq('active', true).single();
            if (coupon) {
                const c = coupon as any;
                if (!c.max_uses || c.current_uses < c.max_uses) {
                    if (c.discount_type === 'percentage') {
                        discountAmount = Math.floor(basePrice * (c.discount_value / 100));
                    } else {
                        discountAmount = c.discount_value;
                    }
                    promoApplied = true;
                    // Increment usage
                    await supabase.from('coupons').update({ current_uses: (c.current_uses || 0) + 1 } as never).eq('id', c.id);
                }
            }
        }

        const totalPrice = Math.max(basePrice - discountAmount, 1000); // Min Rp1000 for Midtrans
        const orderId = `VIS-${paymentType === 'infinite_extend' ? 'EXTEND' : 'SIGNUP'}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        const provider = await getActiveProvider();
        const gatewayName = process.env.ACTIVE_GATEWAY === 'mayar' ? 'mayar' : 'midtrans';

        const result = await provider.createTransaction({
            userId: userId as string,
            orderId,
            email: email || 'user@visora.com',
            name: username || 'Visora User',
            amountIdr: totalPrice,
            paymentType: paymentType,
            planType: paymentType === 'plan' ? planType : undefined
        });

        // Ensure user row in Drizzle (ignored if exists)
        await db.insert(users).values({
            id: userId,
            email,
            name: username,
            credits: 0
        }).onConflictDoNothing();

        // Save transaction to Drizzle payments table
        await db.insert(payments).values({
            userId: userId as string,
            orderId,
            gateway: gatewayName,
            type: paymentType as any,
            planType: paymentType === 'plan' ? planType : null,
            amountIdr: totalPrice,
            status: 'pending'
        });

        return res.status(200).json({
            data: {
                snapToken: result.token,
                token: result.token,
                orderId,
                totalPrice,
                gateway: gatewayName,
                redirectUrl: result.redirectUrl,
                clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY,
                isProduction: process.env.MIDTRANS_IS_PROD === 'true',
                userId,
                promoApplied,
                discountAmount,
            }
        });

    } catch (err: any) {
        console.error('Create transaction error:', err);
        return res.status(500).json({ error: 'Gagal membuat transaksi.' });
    }
}
