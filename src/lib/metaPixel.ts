/**
 * Meta Pixel utility with robust event tracking implementation.
 * Base script is loaded in index.html.
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '988932959615649';
// Global test code for CAPI sending to Meta Event Manager
export const FB_TEST_EVENT_CODE = 'TEST31173';

declare global {
    interface Window {
        fbq?: any;
        _fbq?: any;
    }
}

export function generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Pixel is initialized in index.html natively for 100% reliability
export function initPixel(): void {
    if (typeof window === 'undefined' || !window.fbq) return;
    // Base load is done in index.html. We can optionally re-init if really needed,
    // but typically it's ignored by the library if already init.
    // window.fbq('init', PIXEL_ID); 
}

export function trackPageView(): void {
    if (typeof window === 'undefined' || !window.fbq) return;
    // Fire pageview safely. Let Facebook handle session deduplication.
    window.fbq('track', 'PageView', {}, { eventID: generateEventId() });
}

export function trackViewContent(data?: Record<string, any>): void {
    if (typeof window === 'undefined' || !window.fbq) return;
    window.fbq('track', 'ViewContent', data || {}, { eventID: generateEventId() });
}

export function trackInitiateCheckout(eventId?: string): void {
    if (typeof window === 'undefined' || !window.fbq) return;
    window.fbq('track', 'InitiateCheckout', {}, { eventID: eventId || generateEventId() });
}

export function trackAddPaymentInfo(eventId?: string, value?: number): void {
    if (typeof window === 'undefined' || !window.fbq) return;
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
