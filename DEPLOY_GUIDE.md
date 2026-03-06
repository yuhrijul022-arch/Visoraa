# 🚀 Visora Deployment Guide

## Step 1: Git Push

```bash
git add .
git commit -m "feat: Visora SaaS migration"
git push -u origin main
```

---

## Step 2: Set Secret Keys di Vercel

Setelah git push, buka Vercel Dashboard:

1. Buka **https://vercel.com/dashboard**
2. Klik project **Visoraa**
3. Buka **Settings** → **Environment Variables**
4. Tambahkan variable berikut satu per satu:

### 🔒 SECRET KEYS (Wajib di-set HANYA di Vercel — JANGAN di Git)

| Variable Name | Description | Environment |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (dari Supabase Dashboard → Settings → API) | Production, Preview, Development |
| `OPENROUTER_API_KEY` | OpenRouter API key | Production, Preview, Development |
| `MIDTRANS_SERVER_KEY` | Midtrans server key (dari Midtrans Dashboard → Settings → Access Keys) | Production, Preview, Development |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | Production, Preview, Development |
| `MIDTRANS_IS_PROD` | Set `true` untuk Production, `false` untuk Preview/Development | Sesuai environment |

### ✅ PUBLIC KEYS (Sudah ada di .env Git — aman)

| Key | Alasan Aman |
|---|---|
| `VITE_SUPABASE_URL` | URL publik |
| `VITE_SUPABASE_ANON_KEY` | Anon key — dibatasi RLS |
| `VITE_MIDTRANS_CLIENT_KEY` | Client key — hanya untuk menampilkan Snap popup |
| `VITE_MIDTRANS_IS_PROD` | Boolean flag |
| `VITE_SITE_URL` | URL publik |

---

## Step 3: Setup Supabase

### 3a. Jalankan Schema SQL
1. Buka **https://supabase.com/dashboard** → Project kamu
2. Klik **SQL Editor** (menu kiri)
3. Copy isi file `supabase/schema.sql`
4. Paste dan klik **Run**

### 3b. Enable Google Auth
1. Buka **Authentication** → **Providers**
2. Klik **Google**
3. Enable, masukkan Google OAuth Client ID & Secret
4. Set Redirect URL: `https://[your-supabase-ref].supabase.co/auth/v1/callback`

### 3c. Buat Storage Bucket
1. Buka **Storage** → **New Bucket**
2. Nama: `outputs`
3. Centang **Public bucket**
4. Save

---

## Step 4: Setup Midtrans Webhook

1. Login ke **https://dashboard.midtrans.com**
2. Buka **Settings** → **Configuration**
3. Set **Payment Notification URL**: 
   ```
   https://your-domain.vercel.app/api/midtrans-webhook
   ```
4. Save

---

## Step 5: Redeploy

Setelah semua env vars di-set:
1. Buka Vercel → Project → **Deployments**
2. Klik **...** di deployment terbaru
3. Pilih **Redeploy**

---

## ✅ Checklist

- [ ] Git push berhasil
- [ ] Env vars di Vercel terisi semua (6 secret keys)
- [ ] Schema SQL sudah dijalankan di Supabase
- [ ] Google OAuth enabled di Supabase
- [ ] Storage bucket `outputs` dibuat (public)
- [ ] Midtrans webhook URL sudah di-set
- [ ] Redeploy berhasil
