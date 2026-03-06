import { supabase } from './supabaseClient';
import { DesignInputs, FileData, LayoutBlueprint, StyleProfile } from '../../types';

interface GenerateResult {
    status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
    outputs: Array<{ downloadUrl: string; storagePath: string; mimeType: string }>;
    outputCount: number;
    successCount: number;
    failedCount: number;
    error: string | null;
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

    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errMsg = errData.error || `HTTP ${response.status}`;

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
