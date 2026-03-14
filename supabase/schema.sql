-- ================================================
-- Visora Database Schema (Supabase) — COMPLETE
-- Jalankan 1x di SQL Editor Supabase Dashboard
-- ================================================

-- ================================================
-- 1. TABLES
-- ================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    app TEXT DEFAULT 'VIS',
    email TEXT,
    username TEXT,
    credits INTEGER DEFAULT 0,
    pro_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app TEXT DEFAULT 'VIS',
    order_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id),
    email TEXT,
    username TEXT,
    password TEXT,
    credits INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,
    snap_token TEXT,
    status TEXT DEFAULT 'pending',
    credited BOOLEAN DEFAULT false,
    credited_at TIMESTAMP WITH TIME ZONE,
    payment_type TEXT,
    raw_notification JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    prompt TEXT,
    model TEXT,
    status TEXT DEFAULT 'pending',
    credits_used INTEGER DEFAULT 0,
    refunded BOOLEAN DEFAULT false,
    image_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generation_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES public.users(id),
    is_generating BOOLEAN DEFAULT false,
    request_timestamps JSONB DEFAULT '[]'::jsonb,
    fail_count INTEGER DEFAULT 0,
    last_fail_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processed_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    transaction_id UUID,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value INTEGER NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 2. RPC FUNCTIONS
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
-- 3. ENABLE RLS
-- ================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 4. DROP ALL OLD POLICIES (bersihkan dulu)
-- ================================================

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to upsert their own profile" ON public.users;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "generation_logs_select_own" ON public.generation_logs;
DROP POLICY IF EXISTS "coupons_select_active" ON public.coupons;

-- ================================================
-- 5. CREATE FRESH POLICIES
-- ================================================

-- Users: bisa SELECT row sendiri
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Users: bisa UPDATE row sendiri
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Users: bisa INSERT row sendiri (untuk ensureUserRow saat pertama login)
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Transactions: bisa SELECT transaksi sendiri
CREATE POLICY "transactions_select_own" ON public.transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Generation logs: bisa SELECT log sendiri
CREATE POLICY "generation_logs_select_own" ON public.generation_logs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Coupons: siapa saja bisa baca coupon aktif
CREATE POLICY "coupons_select_active" ON public.coupons
    FOR SELECT
    USING (active = true);

-- ================================================
-- 6. REALTIME
-- ================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
END $$;
