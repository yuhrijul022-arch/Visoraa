# VISORA — Product Requirements Document
## Platform Update v2.0

> **Status:** DRAFT | **Versi:** 2.0.0 | **Tanggal:** Maret 2026  
> **Stack:** Next.js · Supabase · Drizzle ORM · Vercel · GitHub · OpenRouter · Midtrans · Mayar.id · fal.ai  
> **Klasifikasi:** CONFIDENTIAL

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Database Schema (Drizzle ORM)](#3-database-schema-drizzle-orm)
4. [Feature: Admin Dashboard](#4-feature-admin-dashboard)
5. [Feature: Dual Payment Gateway](#5-feature-dual-payment-gateway)
6. [Feature: Mode Infinite Generate](#6-feature-mode-infinite-generate)
7. [Restrukturisasi Sistem Credits](#7-restrukturisasi-sistem-credits)
8. [Dual Pricing Plan](#8-dual-pricing-plan)
9. [Google Auth Flow Update](#9-google-auth-flow-update)
10. [API Endpoints](#10-api-endpoints)
11. [Migration & Implementation Plan](#11-migration--implementation-plan)
12. [Security Requirements](#12-security-requirements)
13. [Acceptance Criteria](#13-acceptance-criteria)

---

## 1. Executive Summary

Dokumen ini menjabarkan seluruh requirement teknis dan fungsional untuk update platform Visora versi 2.0. Update ini mencakup enam area perubahan utama yang harus diimplementasi secara terstruktur **tanpa mengganggu core engine generate yang sudah berjalan.**

### 1.1 Scope Update

| # | Area Update | Prioritas | Status Core |
|---|-------------|-----------|-------------|
| 1 | Admin Dashboard & Manajemen API Key | HIGH | New Feature |
| 2 | Dual Payment Gateway (Midtrans ↔ Mayar.id) | CRITICAL | New Feature |
| 3 | Mode Infinite Generate (fal.ai/Flux) | HIGH | New Feature |
| 4 | Restrukturisasi Sistem Credits (1cr = Rp195) | HIGH | Modification |
| 5 | Dual Plan Pricing (Basic Rp99k / Pro Rp145k) | HIGH | Modification |
| 6 | Google Auth Flow → /formorderauth | MEDIUM | New Feature |

### 1.2 Prinsip Utama Pengembangan

- **NON-DESTRUCTIVE** — Core engine generate (Standard & Pro) **TIDAK BOLEH** dimodifikasi
- **BACKWARD COMPATIBLE** — Semua data user existing harus tetap valid
- **FEATURE FLAG** — Payment gateway wajib bisa di-toggle tanpa deployment ulang
- **DRIZZLE ORM** — Semua interaksi database menggunakan Drizzle ORM (PostgreSQL via Supabase)
- **TYPE-SAFE** — Semua schema database harus didefinisikan dengan Drizzle schema

---

## 2. Tech Stack & Architecture

### 2.1 Stack (Existing + Additions)

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| Frontend | Next.js (App Router) | UI & routing utama |
| Backend | Next.js API Routes / Server Actions | REST API internal |
| Database | Supabase (PostgreSQL) | Primary datastore |
| ORM | **Drizzle ORM** | **NEW** — migrasi dari raw query |
| Auth | Supabase Auth (+ Google OAuth) | User authentication |
| Hosting | Vercel | Deploy & edge functions |
| CI/CD | GitHub Actions | Auto deploy ke Vercel |
| AI Provider | OpenRouter | Routing ke Gemini models |
| Payment #1 | Midtrans | Existing — tetap dipertahankan |
| Payment #2 | **Mayar.id** | **NEW** — untuk lomba & production |
| Image Gen | **fal.ai (Flux Schnell)** | **NEW** — untuk mode Infinite |

### 2.2 Drizzle ORM Setup

#### 2.2.1 Instalasi

```bash
npm install drizzle-orm @supabase/supabase-js postgres
npm install -D drizzle-kit
```

#### 2.2.2 Struktur File

```
src/
  db/
    schema/
      users.ts            # User & auth schema
      credits.ts          # Credits & transactions
      generations.ts      # Generate history
      payments.ts         # Payment records
      paymentGateway.ts   # Gateway config
      infiniteUsage.ts    # Infinite mode usage tracking
    index.ts              # Drizzle client & exports
    migrate.ts            # Migration runner
  lib/
    db.ts                 # Drizzle singleton
```

#### 2.2.3 Konfigurasi `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/*",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

#### 2.2.4 Drizzle Client Singleton

```typescript
// src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

---

## 3. Database Schema (Drizzle ORM)

### 3.1 Schema: `users` (Extended)

```typescript
// src/db/schema/users.ts
import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp"),
  plan: text("plan", { enum: ["basic", "pro"] }).default("basic"),
  planActivatedAt: timestamp("plan_activated_at"),
  credits: integer("credits").notNull().default(0),
  isAdmin: boolean("is_admin").default(false),
  infiniteEnabled: boolean("infinite_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.2 Schema: `credits_transactions`

```typescript
// src/db/schema/credits.ts
export const creditsTransactions = pgTable("credits_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["topup", "generate_standard", "generate_pro", "welcome", "bonus"],
  }).notNull(),
  amount: integer("amount").notNull(),        // positif = masuk, negatif = keluar
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  meta: jsonb("meta"),                        // { orderId, prompt_length, gateway, etc }
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 3.3 Schema: `infinite_usage`

```typescript
// src/db/schema/infiniteUsage.ts
export const infiniteUsage = pgTable("infinite_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  dailyCount: integer("daily_count").notNull().default(0),
  dailyResetAt: timestamp("daily_reset_at").notNull(),
  lifetimeCount: integer("lifetime_count").notNull().default(0),
  lifetimeLimitExtendedAt: timestamp("lifetime_limit_extended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userIdx: uniqueIndex("infinite_usage_user_idx").on(t.userId),
}));
```

> **Catatan:** Daily limit = 30 generate/hari. Lifetime limit = 1.000 generate total. Reset harian via Vercel Cron setiap 00:00 WIB.

### 3.4 Schema: `payments`

```typescript
// src/db/schema/payments.ts
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  orderId: text("order_id").notNull().unique(),
  gateway: text("gateway", { enum: ["midtrans", "mayar"] }).notNull(),
  type: text("type", { enum: ["plan", "topup", "infinite_extend"] }).notNull(),
  planType: text("plan_type", { enum: ["basic", "pro"] }),
  creditsAmount: integer("credits_amount"),
  amountIdr: integer("amount_idr").notNull(),    // dalam Rupiah
  status: text("status", {
    enum: ["pending", "paid", "failed", "expired", "refunded"],
  }).default("pending"),
  gatewayResponse: jsonb("gateway_response"),
  webhookReceivedAt: timestamp("webhook_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.5 Schema: `payment_gateway_config`

```typescript
// src/db/schema/paymentGateway.ts
export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  gateway: text("gateway", { enum: ["midtrans", "mayar"] }).notNull().unique(),
  isActive: boolean("is_active").default(false),
  serverKey: text("server_key"),          // encrypted at rest (AES-256-GCM)
  clientKey: text("client_key"),          // encrypted at rest
  webhookSecret: text("webhook_secret"),  // encrypted at rest
  webhookUrl: text("webhook_url"),        // auto-generated
  sandboxMode: boolean("sandbox_mode").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

> **Constraint:** Hanya boleh ada 1 gateway dengan `isActive = true` pada satu waktu. Enforced di level aplikasi.

### 3.6 Schema: `api_keys`

```typescript
// src/db/schema/apiKeys.ts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  provider: text("provider", {
    enum: ["openrouter", "falai", "supabase", "midtrans", "mayar"],
  }).notNull(),
  keyValue: text("key_value").notNull(),   // encrypted AES-256-GCM
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.7 Schema: `admin_logs` (Audit Trail)

```typescript
export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),       // e.g. "edit_credits", "toggle_gateway"
  targetUserId: uuid("target_user_id").references(() => users.id),
  meta: jsonb("meta"),                    // detail perubahan
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 4. Feature: Admin Dashboard

### 4.1 Overview

Admin Dashboard adalah interface khusus di `/admin/*` yang hanya dapat diakses oleh user dengan `isAdmin = true`. Semua endpoint admin wajib dilindungi dengan middleware autentikasi + role check.

### 4.2 Halaman Admin

#### 4.2.1 `/admin` — Overview / Home

- Total user terdaftar (basic vs pro)
- Total revenue hari ini / bulan ini (per gateway)
- Total generate hari ini (standard / pro / infinite)
- Credit yang beredar di seluruh user
- Status gateway aktif (indicator badge real-time)

#### 4.2.2 `/admin/users` — Manajemen User

| Fitur | Deskripsi |
|-------|-----------|
| List user | Table pagination dengan search by email/nama |
| Detail user | Lihat credits, plan, riwayat generate, riwayat topup |
| Edit credits | Manual tambah/kurangi credits user (dengan audit log) |
| Toggle plan | Upgrade user basic → pro (tidak bisa downgrade) |
| Toggle Infinite | Enable/disable akses mode Infinite per user |
| Reset lifetime limit | Manual reset infinite lifetime limit user |
| Suspend user | Nonaktifkan akses user (soft delete via `isSuspended` flag) |

#### 4.2.3 `/admin/api-keys` — Manajemen API Key

- CRUD API key per provider (openrouter, fal.ai, supabase, midtrans, mayar)
- Key value di-mask pada tampilan (tampilkan hanya 4 karakter terakhir)
- Toggle active/inactive per key
- Catat `lastUsedAt` otomatis ketika key digunakan
- Enkripsi key menggunakan AES-256-GCM sebelum disimpan ke DB

#### 4.2.4 `/admin/payment-gateway` — Manajemen Payment Gateway

| Komponen UI | Fungsi |
|-------------|--------|
| Toggle Switch Midtrans | Aktifkan/nonaktifkan Midtrans sebagai gateway |
| Toggle Switch Mayar.id | Aktifkan/nonaktifkan Mayar.id sebagai gateway |
| Input Server Key | Input server key per gateway (field di-mask) |
| Input Client Key | Input client key per gateway |
| Sandbox Mode Toggle | Beralih antara sandbox dan production per gateway |
| Auto-generate Webhook URL | Tombol generate URL webhook unik per gateway |
| Copy Webhook URL | Salin URL webhook ke clipboard |
| Test Connection | Ping ke API gateway untuk validasi key |
| Save Config | Simpan konfigurasi gateway (validasi sebelum save) |

**Business Rules — Gateway Toggle:**

- Hanya 1 gateway boleh aktif sekaligus (mutual exclusive)
- Ketika toggle Mayar diaktifkan → Midtrans otomatis dimatikan (dan sebaliknya)
- Konfirmasi dialog wajib muncul sebelum switch gateway aktif
- Semua payment yang `pending` di gateway lama tetap diproses (tidak di-cancel)

#### 4.2.5 `/admin/monitoring` — Monitoring Generate

- Real-time counter generate per mode hari ini
- Chart generate per hari (7 hari terakhir)
- Top 10 user berdasarkan total generate
- Alert jika ada user yang mendekati limit infinite (> 900 lifetime)

### 4.3 Route Protection

```typescript
// src/middleware.ts
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const user = await getSessionUser(req);
    if (!user?.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

---

## 5. Feature: Dual Payment Gateway

### 5.1 Arsitektur Payment Abstraction Layer

Buat abstraksi layer (Payment Provider Interface) sehingga logika bisnis tidak bergantung pada implementasi spesifik gateway. Ini memungkinkan switch gateway tanpa mengubah kode bisnis.

```typescript
// src/lib/payment/types.ts
export interface PaymentProvider {
  createTransaction(params: CreateTxParams): Promise<TxResult>;
  verifyWebhook(payload: unknown, signature: string): boolean;
  getTransactionStatus(orderId: string): Promise<TxStatus>;
}

export interface CreateTxParams {
  orderId: string;
  amountIdr: number;
  description: string;
  customer: { name: string; email: string; phone?: string };
  redirectUrl: string;
  callbackUrl: string;
}

export interface TxResult {
  paymentUrl: string;
  token?: string;     // Midtrans Snap token
  externalId?: string;
}
```

```typescript
// src/lib/payment/factory.ts
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { paymentGatewayConfig } from "@/db/schema";

export async function getActiveProvider(): Promise<PaymentProvider> {
  const config = await db.query.paymentGatewayConfig.findFirst({
    where: eq(paymentGatewayConfig.isActive, true),
  });

  if (config?.gateway === "mayar") return new MayarProvider(config);
  return new MidtransProvider(config);
}
```

### 5.2 Implementasi Midtrans Provider

Kode Midtrans yang sudah ada **TIDAK DIHAPUS**, hanya di-wrap ke dalam class `MidtransProvider`.

```typescript
// src/lib/payment/midtrans.ts
export class MidtransProvider implements PaymentProvider {
  private serverKey: string;
  private clientKey: string;

  constructor(config: GatewayConfig) {
    // Prioritas: nilai dari DB (decrypted), fallback ke .env
    this.serverKey = config?.serverKey
      ? decryptKey(config.serverKey)
      : process.env.MIDTRANS_SERVER_KEY!;
    this.clientKey = config?.clientKey
      ? decryptKey(config.clientKey)
      : process.env.MIDTRANS_CLIENT_KEY!;
  }

  async createTransaction(params: CreateTxParams): Promise<TxResult> {
    // existing Midtrans Snap logic — TIDAK DIMODIFIKASI
  }

  verifyWebhook(payload: unknown, signature: string): boolean {
    // existing SHA-512 verification — TIDAK DIMODIFIKASI
  }

  async getTransactionStatus(orderId: string): Promise<TxStatus> {
    // existing status check — TIDAK DIMODIFIKASI
  }
}
```

- Webhook endpoint: `/api/webhook/midtrans`
- Signature verification: SHA-512 (existing logic, tidak diubah)

### 5.3 Implementasi Mayar.id Provider

#### 5.3.1 Endpoint Mayar.id API

| Endpoint Mayar.id | Digunakan untuk | Method |
|-------------------|-----------------|--------|
| `/api/v2/payment-links` | Buat payment link | POST |
| `/api/v2/transactions/{id}` | Cek status transaksi | GET |
| Header `X-Mayar-Signature` | Verifikasi webhook | HMAC-SHA256 |

#### 5.3.2 Implementasi

```typescript
// src/lib/payment/mayar.ts
export class MayarProvider implements PaymentProvider {
  private serverKey: string;
  private webhookSecret: string;

  constructor(config: GatewayConfig) {
    this.serverKey = decryptKey(config.serverKey!);
    this.webhookSecret = decryptKey(config.webhookSecret!);
  }

  async createTransaction(params: CreateTxParams): Promise<TxResult> {
    const response = await fetch("https://mayar.id/api/v2/payment-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.serverKey}`,
      },
      body: JSON.stringify({
        amount: params.amountIdr,
        external_id: params.orderId,
        description: params.description,
        redirect_url: params.redirectUrl,
        callback_url: params.callbackUrl,
        customer: {
          name: params.customer.name,
          email: params.customer.email,
          phone: params.customer.phone,
        },
      }),
    });

    const data = await response.json();
    return { paymentUrl: data.payment_url, externalId: data.id };
  }

  verifyWebhook(payload: unknown, signature: string): boolean {
    const expectedSig = createHmac("sha256", this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  }
}
```

#### 5.3.3 Webhook Handler Mayar — `/api/webhook/mayar`

```typescript
// src/app/api/webhook/mayar/route.ts
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-mayar-signature") ?? "";

  const provider = new MayarProvider(await getGatewayConfig("mayar"));
  if (!provider.verifyWebhook(JSON.parse(rawBody), signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.completed") {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.orderId, event.external_id),
    });
    if (payment) {
      await fulfillPayment(payment);
      await db.update(payments)
        .set({ status: "paid", webhookReceivedAt: new Date(), gatewayResponse: event })
        .where(eq(payments.id, payment.id));
    }
  }

  return new Response("OK", { status: 200 }); // wajib 200 agar tidak retry
}
```

### 5.4 Auto-Generate Webhook URL

```typescript
// Format URL:
// Midtrans : https://[domain]/api/webhook/midtrans
// Mayar.id : https://[domain]/api/webhook/mayar?token=[uuid_secret]

export function generateWebhookUrl(gateway: "midtrans" | "mayar"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (gateway === "mayar") {
    const token = crypto.randomUUID();
    return `${base}/api/webhook/mayar?token=${token}`;
  }
  return `${base}/api/webhook/midtrans`;
}
```

URL ini ditampilkan ke admin untuk didaftarkan di dashboard Midtrans / Mayar.id.

### 5.5 Shared Fulfillment Logic

```typescript
// src/lib/payment/fulfill.ts
export async function fulfillPayment(payment: Payment) {
  if (payment.type === "plan") {
    await db.update(users)
      .set({ plan: payment.planType, planActivatedAt: new Date() })
      .where(eq(users.id, payment.userId!));

    const welcomeCredits = payment.planType === "pro" ? 400 : 250;
    await addCredits(payment.userId!, welcomeCredits, "welcome", {
      orderId: payment.orderId,
    });

    if (payment.planType === "pro") {
      await db.update(users)
        .set({ infiniteEnabled: true })
        .where(eq(users.id, payment.userId!));
    }
  } else if (payment.type === "topup") {
    await addCredits(payment.userId!, payment.creditsAmount!, "topup", {
      orderId: payment.orderId,
    });
  } else if (payment.type === "infinite_extend") {
    await db.update(infiniteUsage)
      .set({ lifetimeCount: 0, lifetimeLimitExtendedAt: new Date() })
      .where(eq(infiniteUsage.userId, payment.userId!));
  }
}
```

---

## 6. Feature: Mode Infinite Generate

### 6.1 Overview

Mode Infinite adalah generate mode ketiga yang menggunakan **Flux Schnell via fal.ai**. Mode ini **tidak memotong credits** namun memiliki 2 level batasan: harian dan lifetime.

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Provider | fal.ai | — |
| Model | `fal-ai/flux/schnell` | Fast, optimized image gen |
| Cost Credits | **0 credits** | Tidak memotong credits user |
| Daily Limit | **30 generate/hari** | Reset 00:00 WIB (UTC+7) |
| Lifetime Limit | **1.000 generate** | Per user, tidak auto reset |
| Eligibility | **Plan Pro only** | User Basic tidak bisa akses |
| Output Quality | Sama dengan Standard | Prompt optimization tetap jalan |

### 6.2 Alur Extend Lifetime Limit

1. User mencapai 1.000 lifetime generate
2. Sistem menampilkan notifikasi: *"Lifetime limit habis. Topup min. Rp100.000 untuk memperbarui 1.000 limit."*
3. User melakukan topup Rp100.000 (payment type = `infinite_extend`)
4. Setelah payment confirmed: `lifetimeCount` di-reset ke 0, `lifetimeLimitExtendedAt` dicatat
5. User dapat melanjutkan generate infinite

> **Penting:** Topup Rp100.000 untuk extend lifetime bukan membeli credits biasa. Ini adalah "refresh limit" dengan payment type khusus `infinite_extend`.

### 6.3 fal.ai Integration

```typescript
// src/lib/ai/falai.ts
import * as fal from "@fal-ai/serverless-client";

fal.config({ credentials: process.env.FAL_KEY });

export async function generateInfinite(params: {
  prompt: string;
  imageUrl?: string;   // untuk image-to-image
}): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: params.prompt,
      image_url: params.imageUrl,
      num_inference_steps: 4,
      image_size: "landscape_4_3",
    },
  });
  return result.images[0].url;
}
```

### 6.4 Rate Limit Logic

```typescript
// src/lib/infinite/rateLimit.ts
export async function checkAndIncrementInfiniteUsage(userId: string) {
  const usage = await db.query.infiniteUsage.findFirst({
    where: eq(infiniteUsage.userId, userId),
  });

  const now = new Date();
  const todayStart = startOfDayWIB(now);
  const isNewDay = !usage || usage.dailyResetAt < todayStart;

  const dailyCount = isNewDay ? 0 : (usage?.dailyCount ?? 0);
  const lifetimeCount = usage?.lifetimeCount ?? 0;

  if (dailyCount >= 30) throw new Error("DAILY_LIMIT_REACHED");
  if (lifetimeCount >= 1000) throw new Error("LIFETIME_LIMIT_REACHED");

  await db
    .insert(infiniteUsage)
    .values({
      userId,
      dailyCount: 1,
      dailyResetAt: tomorrowStartWIB(now),
      lifetimeCount: 1,
    })
    .onConflictDoUpdate({
      target: infiniteUsage.userId,
      set: {
        dailyCount: isNewDay ? 1 : sql`${infiniteUsage.dailyCount} + 1`,
        dailyResetAt: isNewDay ? tomorrowStartWIB(now) : undefined,
        lifetimeCount: sql`${infiniteUsage.lifetimeCount} + 1`,
        updatedAt: now,
      },
    });
}
```

### 6.5 Vercel Cron — Daily Reset

```typescript
// src/app/api/cron/reset-infinite/route.ts
// vercel.json: { "crons": [{ "path": "/api/cron/reset-infinite", "schedule": "0 17 * * *" }] }
// 17:00 UTC = 00:00 WIB
export async function GET(req: Request) {
  // Verifikasi cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await db.update(infiniteUsage).set({
    dailyCount: 0,
    dailyResetAt: tomorrow(),
  });

  return Response.json({ ok: true });
}
```

---

## 7. Restrukturisasi Sistem Credits

### 7.1 Credit Value

> **1 credit = Rp195**

Tujuan psikologis: user merasa mendapatkan banyak credits saat topup.

### 7.2 Biaya Generate per Mode

| Mode | Prompt Normal | Prompt Kompleks/Panjang | Kriteria Kompleks |
|------|--------------|-------------------------|-------------------|
| **Standard** | 30 credits | 37 credits | Prompt > 200 karakter, atau ≥ 2 kata kunci kompleks |
| **Pro** | 55 credits | 65 credits | Prompt > 200 karakter, atau ≥ 2 kata kunci kompleks |
| **Infinite** | 0 credits | 0 credits | — |

#### 7.2.1 Logika Deteksi "Prompt Kompleks"

```typescript
// src/lib/credits/costCalculator.ts
const COMPLEX_KEYWORDS = [
  "background", "layer", "blend", "composite", "multiple",
  "replace", "add", "remove", "change", "transform",
];

export function isComplexPrompt(prompt: string): boolean {
  const hasLongPrompt = prompt.length > 200;
  const matchCount = COMPLEX_KEYWORDS.filter(
    (k) => prompt.toLowerCase().includes(k)
  ).length;
  return hasLongPrompt || matchCount >= 2;
}

export function calculateCost(
  mode: "standard" | "pro",
  prompt: string
): number {
  const complex = isComplexPrompt(prompt);
  if (mode === "standard") return complex ? 37 : 30;
  if (mode === "pro") return complex ? 65 : 55;
  return 0; // infinite
}
```

> **PENTING:** Logika ini bersifat add-on. Core engine generate **TIDAK DIMODIFIKASI**. Hanya pengecekan cost yang ditambahkan **sebelum** memanggil engine.

### 7.3 Paket Topup (Revised)

Formula: `credits = Math.ceil(hargaIdr / 195)`

| Paket | Harga (IDR) | Kalkulasi | Credits Final |
|-------|------------|-----------|---------------|
| Starter | Rp10.000 | 51.28 | **52 credits** |
| Basic | Rp25.000 | 128.2 | **129 credits** |
| Standard | Rp50.000 | 256.4 | **257 credits** |
| Popular | Rp100.000 | 512.8 | **513 credits** |
| Pro | Rp200.000 | 1025.6 | **1026 credits** |
| Ultimate | Rp500.000 | 2564.1 | **2565 credits** |

### 7.4 Custom Topup

- Minimum: **Rp10.000**
- Formula: `Math.ceil(amountIdr / 195)`
- Tampilkan preview credits sebelum user konfirmasi
- Contoh UI: *"Topup Rp35.000 = 180 credits"*

---

## 8. Dual Pricing Plan

### 8.1 Struktur Plan

| Fitur | Plan Basic (Rp99.000) | Plan Pro (Rp145.000) |
|-------|-----------------------|----------------------|
| Harga | Rp99.000 | Rp145.000 |
| Akses | Lifetime (1x bayar) | Lifetime (1x bayar) |
| Mode Standard | ✅ (30/37 credits) | ✅ (30/37 credits) |
| Mode Pro | ✅ (55/65 credits) | ✅ (55/65 credits) |
| Mode Infinite | ❌ Tidak tersedia | ✅ 30/hari, 1.000 lifetime |
| Welcome Credits | 250 credits *(hidden)* | 400 credits *(hidden)* |
| Upgrade ke Pro | Tersedia | N/A |
| Downgrade ke Basic | N/A | ❌ Tidak bisa |

### 8.2 Welcome Credits (Hidden Logic)

- Welcome credits **TIDAK** ditampilkan di landing page / pricing card
- Diberikan otomatis setelah payment confirmed melalui `fulfillPayment()`
- Basic plan: **+250 credits** setelah aktivasi
- Pro plan: **+400 credits** setelah aktivasi
- Tercatat di `credits_transactions` dengan `type = "welcome"`

### 8.3 Upgrade Flow (Basic → Pro)

1. User di dashboard klik "Upgrade ke Pro"
2. Sistem cek `user.plan === "basic"` dan `user.planActivatedAt !== null`
3. Tampilkan halaman upgrade dengan harga **Rp145.000** (bayar penuh)
4. Setelah payment confirmed:
   - Update `plan: "pro"`
   - Set `infiniteEnabled: true`
   - Tambah **150 credits** bonus (400 - 250, karena sudah dapat welcome basic)
   - Catat di `credits_transactions` dengan `type: "bonus"`

> **Catatan:** Downgrade dari Pro ke Basic **tidak diperbolehkan** di level UI dan API.

### 8.4 Implementasi di Semua Halaman

| Halaman | Perubahan |
|---------|-----------|
| `/` (landing) | Tampilkan 2 plan card (Basic & Pro) side by side |
| `/formorder` | Tambah radio button pilih plan (Basic / Pro) |
| `/lpform` | Sesuaikan dengan struktur plan baru |
| `/formorderauth` *(new)* | Lihat Section 9 |
| `/dashboard` | Tampilkan badge plan + tombol upgrade jika Basic |

---

## 9. Google Auth Flow Update

### 9.1 Overview

Ketika user melakukan Sign In with Google untuk **pertama kali** (new user), alih-alih langsung masuk ke dashboard, user diarahkan ke `/formorderauth` untuk melengkapi data diri dan memilih plan.

### 9.2 Flow

```
User klik "Sign in with Google"
        ↓
Supabase Google OAuth callback
        ↓
Middleware: apakah user sudah punya plan?
        ↓                    ↓
   BELUM punya plan     SUDAH punya plan
        ↓                    ↓
/formorderauth          /dashboard
        ↓
User isi nama, WhatsApp, pilih plan
        ↓
Payment (via gateway aktif)
        ↓
fulfillPayment() → aktivasi plan + welcome credits
        ↓
Auto redirect ke /dashboard (session masih aktif)
        ↓
Welcome modal/toast tampil
```

### 9.3 Perbedaan `/formorder` vs `/formorderauth`

| Elemen | `/formorder` (existing) | `/formorderauth` (new) |
|--------|------------------------|------------------------|
| Input Nama | Ada, isi manual | Ada — pre-fill dari Google profile |
| Input Email | Ada, isi manual | Hidden/readonly — dari Google auth |
| Input No. WhatsApp | Placeholder: "Nomor WhatsApp" | Placeholder: "No. WhatsApp Aktif" |
| Pilih Plan | Basic / Pro | Basic / Pro |
| Auth State | User belum login | User sudah authenticated via Google |
| Setelah bayar | Arahkan ke login | Auto login langsung ke `/dashboard` |

### 9.4 Implementasi

```typescript
// src/app/formorderauth/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getUserByEmail } from "@/lib/user";

export default async function FormOrderAuth() {
  const session = await getServerSession();
  if (!session?.user) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (user?.plan) redirect("/dashboard");   // sudah punya plan

  return (
    <FormOrderAuthClient
      prefilledName={session.user.name ?? ""}
      prefilledEmail={session.user.email ?? ""}
    />
  );
}
```

### 9.5 Middleware Check

```typescript
// Tambahkan ke src/middleware.ts
if (
  req.nextUrl.pathname.startsWith("/dashboard") ||
  req.nextUrl.pathname.startsWith("/generate")
) {
  const user = await getSessionUser(req);
  if (user && !user.plan) {
    return NextResponse.redirect(new URL("/formorderauth", req.url));
  }
}
```

---

## 10. API Endpoints

### 10.1 Payment Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/payment/create` | User | Buat transaksi baru (plan/topup) |
| GET | `/api/payment/status/:orderId` | User | Cek status payment |
| POST | `/api/webhook/midtrans` | Public + Sig | Webhook handler Midtrans |
| POST | `/api/webhook/mayar` | Public + Sig | Webhook handler Mayar.id |

### 10.2 Generate Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/generate/standard` | User | Generate mode Standard *(existing — tidak diubah)* |
| POST | `/api/generate/pro` | User | Generate mode Pro *(existing — tidak diubah)* |
| POST | `/api/generate/infinite` | User + Pro | Generate mode Infinite *(new)* |
| GET | `/api/generate/infinite/status` | User + Pro | Cek sisa limit infinite user |

**Catatan:** Endpoint Standard dan Pro hanya ditambahkan credit cost check di awal handler, tidak mengubah logika generate itu sendiri.

### 10.3 Admin Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/admin/users` | Admin | List semua user (pagination) |
| GET | `/api/admin/users/:id` | Admin | Detail user |
| PATCH | `/api/admin/users/:id` | Admin | Update user (credits, plan, infinite) |
| GET | `/api/admin/stats` | Admin | Dashboard stats & metrics |
| GET | `/api/admin/api-keys` | Admin | List API keys (masked) |
| POST | `/api/admin/api-keys` | Admin | Tambah API key baru |
| PATCH | `/api/admin/api-keys/:id` | Admin | Update / toggle API key |
| DELETE | `/api/admin/api-keys/:id` | Admin | Hapus API key |
| GET | `/api/admin/gateway` | Admin | Get semua gateway config |
| PATCH | `/api/admin/gateway` | Admin | Update gateway config (key/toggle) |
| POST | `/api/admin/gateway/webhook` | Admin | Generate webhook URL |
| POST | `/api/admin/gateway/test` | Admin | Test koneksi gateway |

### 10.4 Credits Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/credits/balance` | User | Cek saldo credits |
| GET | `/api/credits/history` | User | Riwayat transaksi credits |
| POST | `/api/credits/topup` | User | Buat transaksi topup |

---

## 11. Migration & Implementation Plan

### 11.1 Fase Implementasi

| Fase | Scope | Estimasi | Dependency |
|------|-------|----------|------------|
| **Fase 0** | Setup Drizzle ORM + schema migration | 1–2 hari | — |
| **Fase 1** | Payment Abstraction Layer + Mayar.id | 2–3 hari | Fase 0 |
| **Fase 2** | Admin Dashboard (users, gateway, api-keys) | 3–4 hari | Fase 0, 1 |
| **Fase 3** | Credit system overhaul (rate Rp195) | 1–2 hari | Fase 0 |
| **Fase 4** | Mode Infinite + fal.ai integration | 2–3 hari | Fase 0, 3 |
| **Fase 5** | Dual plan pricing + formorderauth | 2–3 hari | Fase 1, 3, 4 |
| **Fase 6** | Testing E2E + staging validation | 2–3 hari | Semua fase |

### 11.2 Drizzle Migration Steps

```bash
# 1. Install dependencies
npm install drizzle-orm @supabase/supabase-js postgres
npm install -D drizzle-kit

# 2. Generate migration SQL
npx drizzle-kit generate:pg

# 3. Review file di /drizzle/*.sql sebelum apply

# 4. Push ke Supabase
npx drizzle-kit push:pg

# 5. Verifikasi tabel di Supabase dashboard
```

### 11.3 Environment Variables Baru

| Variable | Deskripsi | Required |
|----------|-----------|----------|
| `DATABASE_URL` | Supabase connection string (untuk Drizzle) | **YES** |
| `FAL_KEY` | API key fal.ai untuk Flux Schnell | **YES** |
| `ENCRYPTION_KEY` | AES-256 key (32 bytes hex) untuk enkripsi API keys | **YES** |
| `CRON_SECRET` | Secret untuk auth Vercel Cron endpoint | **YES** |
| `NEXT_PUBLIC_APP_URL` | URL app untuk generate webhook URL | **YES** |
| `MAYAR_SERVER_KEY` | Fallback jika belum di-set via admin dashboard | NO |
| `MAYAR_WEBHOOK_SECRET` | Fallback webhook secret Mayar.id | NO |

### 11.4 Hal yang TIDAK BOLEH Diubah

> ❌ Modifikasi hal-hal berikut dapat menyebabkan regresi fatal.

- Core engine generate Standard (model, prompt processing, output handling)
- Core engine generate Pro (model, prompt processing, output handling)
- Existing Midtrans payment code (hanya di-wrap, tidak dihapus)
- Supabase Auth setup dan session management
- Existing user data di database (migrasi harus backward compatible)
- Struktur routing yang sudah ada di Next.js App Router

---

## 12. Security Requirements

### 12.1 API Key Encryption

Semua API key yang disimpan di database wajib dienkripsi menggunakan **AES-256-GCM** sebelum disimpan.

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encryptKey(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptKey(encrypted: string): string {
  const [ivHex, tagHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}
```

### 12.2 Webhook Security

- **Midtrans:** Verifikasi SHA-512 signature (existing logic — jangan diubah)
- **Mayar.id:** Verifikasi HMAC-SHA256 dari header `X-Mayar-Signature`
- Semua webhook endpoint menggunakan **raw body parsing** (tidak JSON.parse dulu)
- Rate limit webhook: max 100 req/menit per IP

### 12.3 Admin Route Protection

- Middleware cek `isAdmin` flag di setiap request ke `/admin/*`
- Semua admin API routes cek session + `isAdmin` sebelum proses
- Admin actions dicatat ke tabel `admin_logs` (audit trail)

### 12.4 Input Validation

- Gunakan **Zod** untuk validasi semua API input
- Sanitasi prompt sebelum dikirim ke AI provider
- Validasi amount topup: harus integer, minimum Rp10.000, maksimum Rp10.000.000

```typescript
// src/lib/validation/payment.ts
import { z } from "zod";

export const topupSchema = z.object({
  amountIdr: z
    .number()
    .int()
    .min(10_000, "Minimum topup Rp10.000")
    .max(10_000_000, "Maximum topup Rp10.000.000"),
});

export const createPlanSchema = z.object({
  planType: z.enum(["basic", "pro"]),
  name: z.string().min(2).max(100),
  whatsapp: z.string().regex(/^08[0-9]{8,11}$/, "Format WhatsApp tidak valid"),
});
```

---

## 13. Acceptance Criteria

### 13.1 Admin Dashboard

- [ ] Admin dapat login dan akses `/admin` tanpa error
- [ ] Non-admin di-redirect ke `/` ketika akses `/admin`
- [ ] CRUD API keys berfungsi, nilai ter-mask di UI
- [ ] Toggle gateway berfungsi, hanya 1 aktif sekaligus
- [ ] Konfirmasi dialog muncul sebelum switch gateway
- [ ] Webhook URL ter-generate dan dapat dicopy
- [ ] Edit credits user tersimpan dan tercatat di `admin_logs`
- [ ] Upgrade plan user Basic → Pro berfungsi
- [ ] Suspend user berhasil memblokir akses

### 13.2 Payment Gateway

- [ ] Pembayaran via Midtrans (existing) masih berfungsi normal
- [ ] Pembayaran via Mayar.id berhasil create payment link
- [ ] Webhook Mayar.id diterima dan signature ter-verifikasi
- [ ] Plan teraktivasi otomatis setelah payment confirmed
- [ ] Welcome credits diberikan setelah aktivasi plan
- [ ] Switch gateway di admin tidak menyebabkan data hilang
- [ ] Payment pending di gateway lama tetap diproses setelah switch

### 13.3 Infinite Mode

- [ ] User Basic tidak bisa akses mode Infinite (API return 403)
- [ ] User Pro bisa generate via Infinite
- [ ] Daily limit 30 di-enforce dan reset tiap hari
- [ ] Lifetime limit 1.000 di-enforce
- [ ] Notifikasi muncul ketika limit habis
- [ ] Extend lifetime via topup Rp100.000 berfungsi
- [ ] Credits tidak terpotong saat generate Infinite
- [ ] Vercel Cron reset harian berjalan sesuai jadwal

### 13.4 Credit System

- [ ] 30 credits terpotong untuk Standard prompt normal
- [ ] 37 credits terpotong untuk Standard prompt kompleks
- [ ] 55 credits terpotong untuk Pro prompt normal
- [ ] 65 credits terpotong untuk Pro prompt kompleks
- [ ] Topup custom minimal Rp10.000 berjalan
- [ ] Kalkulasi credits topup menggunakan `Math.ceil(amount / 195)`
- [ ] Preview credits tampil sebelum konfirmasi topup
- [ ] Riwayat transaksi credits tercatat lengkap

### 13.5 Plan & Auth

- [ ] Landing page menampilkan 2 plan (Basic & Pro) side by side
- [ ] User Google baru diarahkan ke `/formorderauth`
- [ ] User Google existing (punya plan) langsung ke `/dashboard`
- [ ] Welcome credits tidak tampil di landing page
- [ ] Basic user tidak bisa downgrade (UI dan API level)
- [ ] Pro user dapat akses infinite di dashboard
- [ ] Upgrade flow Basic → Pro berfungsi dengan bonus 150 credits
- [ ] `/formorderauth` pre-fill nama dari Google profile

---

*Visora PRD v2.0 — CONFIDENTIAL — Maret 2026*
