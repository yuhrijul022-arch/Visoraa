/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_SITE_URL?: string;
    readonly VITE_META_PIXEL_ID?: string;
    readonly VITE_MIDTRANS_CLIENT_KEY?: string;
    readonly VITE_MIDTRANS_CLIENT_KEY_PROD?: string;
    readonly VITE_MIDTRANS_CLIENT_KEY_SANDBOX?: string;
    readonly VITE_MIDTRANS_IS_PROD?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
