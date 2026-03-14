import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

/**
 * Meta Conversion API (CAPI) endpoint.
 * Receives events from frontend or webhook and sends to Meta.
 */

const META_PIXEL_ID = process.env.VITE_META_PIXEL_ID || '988932959615649';
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

function hashSHA256(value: string): string {
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!META_CAPI_TOKEN) {
        return res.status(500).json({ error: 'META_CAPI_TOKEN not configured' });
    }

    try {
        const { eventName, eventId, email, value, currency, sourceUrl, userAgent, fbp, fbc, externalId, testEventCode } = req.body;

        if (!eventName) {
            return res.status(400).json({ error: 'eventName is required' });
        }

        const userData: Record<string, any> = {};
        if (email) userData.em = [hashSHA256(email)];
        if (externalId) userData.external_id = [hashSHA256(externalId)];
        if (fbp) userData.fbp = fbp;
        if (fbc) userData.fbc = fbc;
        if (userAgent) userData.client_user_agent = userAgent;

        const eventData: Record<string, any> = {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            action_source: 'website',
            user_data: userData,
        };

        if (eventId) eventData.event_id = eventId;
        if (sourceUrl) eventData.event_source_url = sourceUrl;

        if (value || currency) {
            eventData.custom_data = {
                currency: currency || 'IDR',
                value: value || 0,
            };
        }

        const payload: Record<string, any> = {
            data: [eventData],
        };

        // Forward test_event_code so test events appear in Events Manager
        if (testEventCode) {
            payload.test_event_code = testEventCode;
        }

        const capiUrl = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`;

        const response = await fetch(capiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('CAPI error:', result);
            return res.status(response.status).json({ error: 'CAPI request failed', details: result });
        }

        return res.status(200).json({ success: true, result });
    } catch (err: any) {
        console.error('CAPI handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal error' });
    }
}
