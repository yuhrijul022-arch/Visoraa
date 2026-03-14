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

    // Helper to send a single request
    const sendRequest = async () => {
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
    };

    if (inputs.mode === 'infinite') {
        // Infinite mode backend only supports 1 image per request due to serverless timeouts.
        // We simulate `inputs.quantity` by queueing requests sequentially on the frontend.
        const targetQuantity = Math.min(Math.max(inputs.quantity || 1, 1), 4);
        let allOutputs: Array<{ downloadUrl: string; storagePath: string; mimeType: string }> = [];
        let successCount = 0;
        let failedCount = 0;
        let lastError = null;

        for (let i = 0; i < targetQuantity; i++) {
            try {
                const res = await sendRequest();
                if (res.outputs && res.outputs.length > 0) {
                    allOutputs = [...allOutputs, ...res.outputs];
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (e: any) {
                failedCount++;
                lastError = e.message;
                // If it's a rate limit or auth error, abort the loop completely
                if (e.message.includes('RATE_LIMITED') || e.message.includes('REDIRECT')) {
                    throw e; 
                }
            }
        }

        if (successCount === 0) {
            throw new Error(lastError || 'All generation attempts failed in Infinite Mode.');
        }

        return {
            status: successCount === targetQuantity ? 'SUCCEEDED' : 'PARTIAL',
            outputs: allOutputs,
            outputCount: allOutputs.length,
            successCount,
            failedCount,
            error: failedCount > 0 ? "Some variations failed to generate." : null,
        };
    } else {
        // Standard / Pro mode handles quantities internally at the backend.
        return await sendRequest();
    }
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
