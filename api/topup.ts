import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const midtransServerKey = process.env.MIDTRANS_SERVER_KEY!;
const midtransClientKey = process.env.MIDTRANS_CLIENT_KEY!;
const midtransIsProd = process.env.MIDTRANS_IS_PROD === 'true';

const CREDIT_PRICE = 5000; // 1 credit = Rp5.000

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        const uid = user.id;
        const { creditsQty } = req.body;
        if (!creditsQty || creditsQty < 1) return res.status(400).json({ error: 'Minimum 1 credit.' });

        const { data: userData } = await supabase.from('users').select('email, username').eq('id', uid).single();
        const email = (userData as any)?.email || user.email || 'unknown@visora.com';
        const username = (userData as any)?.username || 'Visora User';

        const totalPrice = creditsQty * CREDIT_PRICE;
        const orderId = `VIS-TOPUP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

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
                    id: `VISORA_TOPUP_${creditsQty}`,
                    price: totalPrice,
                    quantity: 1,
                    name: `Visora Top Up - ${creditsQty} Credits`,
                }],
                customer_details: { first_name: username, email },
                custom_expiry: { expiry_duration: 15, unit: 'minute' },
            }),
        });

        if (!snapResponse.ok) {
            console.error('Midtrans Snap error:', await snapResponse.text());
            return res.status(500).json({ error: 'Gagal membuat transaksi top-up.' });
        }

        const snapData = await snapResponse.json();

        // Ensure user row exists
        await supabase.from('users').upsert({
            id: uid, app: 'VIS', email, username, credits: 0, pro_active: false,
        } as never, { onConflict: 'id', ignoreDuplicates: true } as any);

        await supabase.from('transactions').insert({
            app: 'VIS', order_id: orderId, type: 'TOPUP', user_id: uid,
            email, credits: creditsQty, amount: totalPrice,
            snap_token: snapData.token, status: 'pending', credited: false,
        } as any);

        return res.status(200).json({
            snapToken: snapData.token,
            orderId, totalPrice,
            clientKey: midtransClientKey,
            isProduction: midtransIsProd,
        });

    } catch (err: any) {
        console.error('Topup error:', err);
        return res.status(500).json({ error: 'Gagal membuat transaksi top-up.' });
    }
}
