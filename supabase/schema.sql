-- ================================================
-- Visora Database Schema (Supabase)
-- ================================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    app TEXT DEFAULT 'VIS',
    email TEXT,
    username TEXT,
    credits INTEGER DEFAULT 0,
    pro_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app TEXT DEFAULT 'VIS',
    order_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- SIGNUP, TOPUP
    user_id UUID REFERENCES public.users(id),
    email TEXT,
    username TEXT,
    password TEXT,
    credits INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,
    snap_token TEXT,
    status TEXT DEFAULT 'pending', -- pending, success, failed, expired
    credited BOOLEAN DEFAULT false,
    credited_at TIMESTAMP WITH TIME ZONE,
    payment_type TEXT,
    raw_notification JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generation logs
CREATE TABLE IF NOT EXISTS public.generation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    prompt TEXT,
    model TEXT,
    status TEXT DEFAULT 'pending', -- pending, success, partial, failed
    credits_used INTEGER DEFAULT 0,
    refunded BOOLEAN DEFAULT false,
    image_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limits
CREATE TABLE IF NOT EXISTS public.generation_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES public.users(id),
    is_generating BOOLEAN DEFAULT false,
    request_timestamps JSONB DEFAULT '[]'::jsonb,
    fail_count INTEGER DEFAULT 0,
    last_fail_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processed notifications (idempotency)
CREATE TABLE IF NOT EXISTS public.processed_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    transaction_id UUID,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL, -- percentage, fixed
    discount_value INTEGER NOT NULL, -- percentage (0-100) or fixed rupiah amount
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RPC Functions
-- ================================================

CREATE OR REPLACE FUNCTION public.deduct_credits_safe(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET credits = GREATEST(credits - p_amount, 0)
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- RLS Policies
-- ================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Users: users can read/update their own row
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Transactions: users can read their own
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Generation logs: users can read their own
CREATE POLICY "generation_logs_select_own" ON public.generation_logs FOR SELECT USING (auth.uid() = user_id);

-- Coupons: anyone can read active coupons
CREATE POLICY "coupons_select_active" ON public.coupons FOR SELECT USING (active = true);

-- Enable realtime for users table
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
