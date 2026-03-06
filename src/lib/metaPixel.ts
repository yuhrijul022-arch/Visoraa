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

// Track fired events for the current active page view to prevent duplicates
let currentActivePath = '';
const firedEventsOnPath = new Set<string>();

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

// Guard to prevent duplicate firing per route sequence
function checkAndSetFired(eventName: string): boolean {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    // If the path changed since the last check, reset the tracking set
    if (currentPath !== currentActivePath) {
        currentActivePath = currentPath;
        firedEventsOnPath.clear();
    }

    if (firedEventsOnPath.has(eventName)) return true;
    firedEventsOnPath.add(eventName);
    return false;
}

export function trackPageView(): void {
    if (!window.fbq || !PIXEL_ID) return;
    // fbq automatically deduplicates PageView internally, but we can double check
    if (checkAndSetFired('PageView')) return;
    window.fbq('track', 'PageView');
}

export function trackViewContent(data?: Record<string, any>): void {
    if (!window.fbq || !PIXEL_ID) return;
    if (checkAndSetFired('ViewContent')) return;
    window.fbq('track', 'ViewContent', data || {});
}

export function trackInitiateCheckout(eventId?: string): void {
    if (!window.fbq || !PIXEL_ID) return;
    if (checkAndSetFired('InitiateCheckout')) return;
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
