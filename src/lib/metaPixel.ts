/**
 * Meta Pixel utility with robust event_id generation for CAPI deduplication.
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
// Global test code for CAPI sending to Meta Event Manager
export const FB_TEST_EVENT_CODE = 'TEST31173';

declare global {
    interface Window {
        fbq?: any;
        _fbq?: any;
    }
}

// Track fired events globally across the SPA session to prevent duplicates
// format: "path::event_name"
const firedEventsHash = new Set<string>();

export function generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Initialize pixel safely
export function initPixel(): void {
    if (!PIXEL_ID || typeof window === 'undefined') return;

    if (window.fbq) return;

    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any) {
        const n: any = (f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        const t = b.createElement(e); t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    window.fbq('init', PIXEL_ID);
}

// Guard to prevent duplicate firing per route instance
function hasEventFiredOnCurrentPath(eventName: string): boolean {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const hashKey = `${currentPath}::${eventName}`;
    
    if (firedEventsHash.has(hashKey)) return true;
    
    firedEventsHash.add(hashKey);
    return false;
}

export function trackPageView(): void {
    if (!window.fbq || !PIXEL_ID) return;
    
    // Reset page view cache if needed, but deduplicate within the exact same paint
    if (hasEventFiredOnCurrentPath('PageView')) return;
    
    window.fbq('track', 'PageView', {}, { eventID: generateEventId() });
}

export function trackViewContent(data?: Record<string, any>): void {
    if (!window.fbq || !PIXEL_ID) return;
    if (hasEventFiredOnCurrentPath('ViewContent')) return;
    
    window.fbq('track', 'ViewContent', data || {}, { eventID: generateEventId() });
}

export function trackInitiateCheckout(eventId?: string): void {
    if (!window.fbq || !PIXEL_ID) return;
    if (hasEventFiredOnCurrentPath('InitiateCheckout')) return;
    
    window.fbq('track', 'InitiateCheckout', {}, { eventID: eventId || generateEventId() });
}

export function trackAddPaymentInfo(eventId?: string, value?: number): void {
    if (!window.fbq || !PIXEL_ID) return;
    
    window.fbq('track', 'AddPaymentInfo', {
        currency: 'IDR',
        value: value || 99000,
    }, { eventID: eventId || generateEventId() });
}

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
