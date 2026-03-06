import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const midtransServerKey = process.env.MIDTRANS_SERVER_KEY!;
const midtransClientKey = process.env.MIDTRANS_CLIENT_KEY!;
const midtransIsProd = process.env.MIDTRANS_IS_PROD === 'true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const { email, username, password, promoCode } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ error: 'Semua field wajib diisi: nama, email, password.' });
        }

        // Create Supabase auth user
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

        const userId = signUpData.user?.id;
        if (!userId) return res.status(500).json({ error: 'Failed to create user.' });

        // Calculate price with promo
        let basePrice = 99000;
        let discountAmount = 0;
        let promoApplied = false;

        if (promoCode) {
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
        const orderId = `VIS-SIGNUP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        // Create Midtrans Snap token
        const midtransBaseUrl = midtransIsProd
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

        const midtransAuth = Buffer.from(`${midtransServerKey}:`).toString('base64');

        const snapResponse = await fetch(midtransBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${midtransAuth}`,
            },
            body: JSON.stringify({
                transaction_details: { order_id: orderId, gross_amount: totalPrice },
                item_details: [{
                    id: 'VISORA_SIGNUP',
                    price: totalPrice,
                    quantity: 1,
                    name: 'Visora - Smart Visual (25 Credits)',
                }],
                customer_details: { first_name: username, email },
                custom_expiry: { expiry_duration: 15, unit: 'minute' },
            }),
        });

        if (!snapResponse.ok) {
            const errText = await snapResponse.text();
            console.error('Midtrans Snap error:', errText);
            return res.status(500).json({ error: 'Gagal membuat transaksi.' });
        }

        const snapData = await snapResponse.json();

        // Ensure user row
        await supabase.from('users').upsert({
            id: userId,
            app: 'VIS',
            email, username,
            credits: 0,
            pro_active: false,
        } as never, { onConflict: 'id', ignoreDuplicates: true } as any);

        // Save transaction draft
        await supabase.from('transactions').insert({
            app: 'VIS',
            order_id: orderId,
            type: 'SIGNUP',
            user_id: userId,
            email, username, password,
            credits: 25,
            amount: totalPrice,
            snap_token: snapData.token,
            status: 'pending',
            credited: false,
        } as any);

        return res.status(200).json({
            data: {
                snapToken: snapData.token,
                orderId,
                totalPrice,
                clientKey: midtransClientKey,
                isProduction: midtransIsProd,
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
