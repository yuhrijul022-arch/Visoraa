import { supabase } from './supabaseClient.js';
import { DesignInputs, FileData, LayoutBlueprint, StyleProfile } from '../../types.js';

interface GenerateResult {
    status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
    outputs: Array<{ downloadUrl: string; storagePath: string; mimeType: string }>;
    outputCount: number;
    successCount: number;
    failedCount: number;
    error: string | null;
    redirectTo?: string;
}

export async function generateViaAPI(
    productImage: FileData,
    refImage: FileData | null,
    inputs: DesignInputs,
    blueprint: LayoutBlueprint | null,
    styleProfile: StyleProfile | null,
): Promise<GenerateResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    const body: Record<string, any> = {
        qty: inputs.quantity || 1,
        ratio: inputs.ratio,
        mode: inputs.mode || 'standard',
        customPrompt: inputs.customPrompt || '',
        textMode: inputs.textMode,
        brandName: inputs.brandName,
        headline: inputs.headline,
        benefit: inputs.benefit,
        price: inputs.price,
        cta: inputs.cta,
        matchStrength: inputs.matchStrength,
        productImage: `data:${productImage.mimeType};base64,${productImage.base64}`,
    };

    if (refImage) {
        body.referenceImage = `data:${refImage.mimeType};base64,${refImage.base64}`;
    }

    if (blueprint) body.blueprint = blueprint;
    if (styleProfile) body.styleProfile = styleProfile;

    const endpoint = inputs.mode === 'infinite' ? '/api/generate-infinite' : '/api/generate';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error', redirectTo: null }));
        const errMsg = errData.error || `HTTP ${response.status}`;
        
        if (errData.redirectTo) {
            throw new Error(`REDIRECT:${errData.redirectTo}:${errMsg}`);
        }

        if (response.status === 402) {
            throw new Error('INSUFFICIENT_CREDITS: ' + errMsg);
        }
        if (response.status === 429) {
            throw new Error('RATE_LIMITED: ' + errMsg);
        }
        throw new Error(errMsg);
    }

    return await response.json();
}

export async function fetchRecentGenerations(uid: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('generation_logs')
        .select('image_urls')
        .eq('user_id', uid)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !data?.[0]) return [];
    return (data[0] as any).image_urls || [];
}
