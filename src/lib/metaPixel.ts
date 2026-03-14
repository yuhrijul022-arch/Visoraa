/**
 * Meta Pixel utility — robust, deduplicated, SPA-safe event tracking.
 * Base pixel script is loaded in index.html AND landing-page.html.
 *
 * Key features:
 * - Deduplication: each route+event combo fires at most once per pathname
 * - fbq readiness: queues events until fbq is loaded (polls up to 5s)
 * - Debug logging: every event logs fire/skip/fail status to console
 * - sendCapiEvent: unified CAPI helper for browser+server dedup
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '988932959615649';
export const FB_TEST_EVENT_CODE = 'TEST31173';

declare global {
    interface Window {
        fbq?: any;
        _fbq?: any;
    }
}

// ── Deduplication ──
// Tracks "pathname:eventName" to prevent re-fires on SPA remounts / StrictMode
const _firedEvents = new Set<string>();
let _lastPathname = typeof window !== 'undefined' ? window.location.pathname : '';

function resetDedupeIfNavigated(): void {
    if (typeof window === 'undefined') return;
    const current = window.location.pathname;
    if (current !== _lastPathname) {
        _firedEvents.clear();
        _lastPathname = current;
    }
}

function shouldFire(eventName: string): boolean {
    resetDedupeIfNavigated();
    const key = `${window.location.pathname}:${eventName}`;
    if (_firedEvents.has(key)) {
        console.log(`[Meta Pixel] ⏭ SKIPPED ${eventName} (already fired on ${window.location.pathname})`);
        return false;
    }
    _firedEvents.add(key);
    return true;
}

// ── Event ID ──
export function generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// ── fbq Readiness ──
// Pixel loads async; this ensures we wait for it (up to 5s).
function waitForFbq(timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') { resolve(false); return; }
        if (window.fbq) { resolve(true); return; }

        const start = Date.now();
        const interval = setInterval(() => {
            if (window.fbq) {
                clearInterval(interval);
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                console.warn('[Meta Pixel] ⚠ fbq not available after 5s — event will be dropped');
                resolve(false);
            }
        }, 50);
    });
}

// ── Core Track Helpers ──

export async function trackPageView(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!shouldFire('PageView')) return;
    const ready = await waitForFbq();
    if (!ready) return;
    try {
        const eid = generateEventId();
        window.fbq('track', 'PageView', {}, { eventID: eid });
        console.log(`[Meta Pixel] ✅ PageView fired | route=${window.location.pathname} | eid=${eid}`);
    } catch (e) { console.error('[Meta Pixel] ❌ PageView error:', e); }
}

export async function trackViewContent(data?: Record<string, any>): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!shouldFire('ViewContent')) return;
    const ready = await waitForFbq();
    if (!ready) return;
    try {
        const eid = generateEventId();
        window.fbq('track', 'ViewContent', data || {}, { eventID: eid });
        console.log(`[Meta Pixel] ✅ ViewContent fired | route=${window.location.pathname} | eid=${eid}`);
    } catch (e) { console.error('[Meta Pixel] ❌ ViewContent error:', e); }
}

export async function trackInitiateCheckout(eventId?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!shouldFire('InitiateCheckout')) return;
    const ready = await waitForFbq();
    if (!ready) return;
    try {
        const eid = eventId || generateEventId();
        window.fbq('track', 'InitiateCheckout', {}, { eventID: eid });
        console.log(`[Meta Pixel] ✅ InitiateCheckout fired | route=${window.location.pathname} | eid=${eid}`);
    } catch (e) { console.error('[Meta Pixel] ❌ InitiateCheckout error:', e); }
}

/**
 * AddPaymentInfo — fires exactly once per call (NOT deduplicated by route,
 * because it's tied to a specific user action, not to entering a route).
 */
export async function trackAddPaymentInfo(eventId?: string, value?: number): Promise<void> {
    if (typeof window === 'undefined') return;
    const ready = await waitForFbq();
    if (!ready) return;
    try {
        const eid = eventId || generateEventId();
        window.fbq('track', 'AddPaymentInfo', {
            currency: 'IDR',
            value: value || 99000,
        }, { eventID: eid });
        console.log(`[Meta Pixel] ✅ AddPaymentInfo fired | value=${value} | eid=${eid}`);
    } catch (e) { console.error('[Meta Pixel] ❌ AddPaymentInfo error:', e); }
}

// ── Cookie Helpers ──

export function getFbpFbc(): { fbp: string | null; fbc: string | null } {
    if (typeof document === 'undefined') return { fbp: null, fbc: null };
    const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        if (key) acc[key] = val || '';
        return acc;
    }, {} as Record<string, string>);

    return {
        fbp: cookies['_fbp'] || null,
        fbc: cookies['_fbc'] || null,
    };
}

// ── CAPI Helper ──
// Unified function to send server-side events. Non-blocking.

export function sendCapiEvent(params: {
    eventName: string;
    eventId: string;
    email?: string;
    value?: number;
    currency?: string;
    externalId?: string;
}): void {
    try {
        const { fbp, fbc } = getFbpFbc();
        fetch('/api/meta-capi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventName: params.eventName,
                eventId: params.eventId,
                email: params.email,
                value: params.value,
                currency: params.currency || 'IDR',
                sourceUrl: window.location.href,
                userAgent: navigator.userAgent,
                fbp, fbc,
                externalId: params.externalId,
                testEventCode: FB_TEST_EVENT_CODE,
            }),
        }).catch(() => { /* non-blocking */ });
    } catch { /* non-blocking */ }
}

// ── Legacy compat ──
// initPixel() is kept for backward compatibility but is now a no-op.
// The pixel base code is loaded in index.html / landing-page.html <head>.
export function initPixel(): void { /* no-op — pixel loaded in HTML */ }
