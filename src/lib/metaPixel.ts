/**
 * Meta Pixel utility with event_id generation for CAPI deduplication.
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';

declare global {
    interface Window {
        fbq?: any;
        _fbq?: any;
    }
}

// Generate unique event ID for deduplication with CAPI
export function generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Initialize pixel (call once on app load)
export function initPixel(): void {
    if (!PIXEL_ID || typeof window === 'undefined') return;
    if (window.fbq) return; // Already initialized

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

// Track standard events
export function trackPageView(): void {
    if (!window.fbq || !PIXEL_ID) return;
    window.fbq('track', 'PageView');
}

export function trackViewContent(data?: Record<string, any>): void {
    if (!window.fbq || !PIXEL_ID) return;
    window.fbq('track', 'ViewContent', data || {});
}

export function trackInitiateCheckout(eventId?: string): void {
    if (!window.fbq || !PIXEL_ID) return;
    window.fbq('track', 'InitiateCheckout', {}, { eventID: eventId || generateEventId() });
}

export function trackAddPaymentInfo(eventId?: string, value?: number): void {
    if (!window.fbq || !PIXEL_ID) return;
    window.fbq('track', 'AddPaymentInfo', {
        currency: 'IDR',
        value: value || 99000,
    }, { eventID: eventId || generateEventId() });
}

export function trackPurchase(eventId: string, value: number): void {
    if (!window.fbq || !PIXEL_ID) return;
    window.fbq('track', 'Purchase', {
        currency: 'IDR',
        value,
    }, { eventID: eventId });
}

// Get fbp and fbc cookies for CAPI
export function getFbpFbc(): { fbp: string | null; fbc: string | null } {
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
