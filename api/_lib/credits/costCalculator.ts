import { PlanType } from '../payment/types';

/**
 * complexity definition based on Visora PRD:
 * - Prompt length > 200 characters
 * - OR contains at least 2 complex keywords
 */
const COMPLEX_KEYWORDS = [
    'hyperrealistic', '4k', '8k', 'unreal engine', 'octane render', 
    'ray tracing', 'masterpiece', 'intricate details', 'cinematic lighting',
    'volumetric', 'hdr', 'studio lighting'
];

export function isComplexPrompt(prompt: string): boolean {
    if (!prompt) return false;
    
    // Condition 1: Length > 200 chars
    if (prompt.length > 200) return true;

    // Condition 2: Contains >= 2 complex keywords
    let keywordCount = 0;
    const lowerPrompt = prompt.toLowerCase();
    
    for (const keyword of COMPLEX_KEYWORDS) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
            keywordCount++;
            if (keywordCount >= 2) return true;
        }
    }

    return false;
}

/**
 * Calculates token/credit cost based on user plan and prompt complexity
 * 
 * Standard Rules (Basic):
 * - Simple: 30 credits
 * - Complex: 37 credits
 * 
 * Pro Rules:
 * - Simple: 55 credits
 * - Complex: 65 credits
 */
export function calculateCost(prompt: string, plan: PlanType): number {
    const isComplex = isComplexPrompt(prompt);

    if (plan === 'pro') {
        return isComplex ? 65 : 55;
    } else {
        return isComplex ? 37 : 30;
    }
}
