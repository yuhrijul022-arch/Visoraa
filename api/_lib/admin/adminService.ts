import { db } from '../db.js';
import { users } from '../../../src/db/schema/users.js';
import { eq } from 'drizzle-orm';

export const SUPER_ADMIN_EMAIL = 'yuhrijul022@gmail.com';

export function isSuperAdmin(email: string | null | undefined): boolean {
    return email === SUPER_ADMIN_EMAIL;
}

export async function setAdminEntitlement(adminEmail: string, targetUserId: string, targetPlan: 'free' | 'basic' | 'pro', reason: string) {
    if (!isSuperAdmin(adminEmail)) throw new Error("Unauthorized: Super Admin strictly required.");

    return await db.transaction(async (tx) => {
        let updatePayload: any = {
            admin_override_reason: reason,
            entitlement_source: 'admin_grant',
            plan: targetPlan,
            updatedAt: new Date()
        };

        if (targetPlan === 'pro') {
            updatePayload.infiniteEnabled = true; // Use camelCase if that's what schema expects
            updatePayload.planActivatedAt = new Date();
        } else if (targetPlan === 'basic' || targetPlan === 'free') {
            updatePayload.infiniteEnabled = false;
        }

        await tx.update(users).set(updatePayload).where(eq(users.id, targetUserId));

        // Returning a flag to instruct frontend to refresh auth session / invalidate cache
        return { success: true, requireSessionRefresh: true };
    });
}

export async function canHardDeleteUser(targetUserId: string): Promise<{ canDelete: boolean; totalPayments: number; totalTransactions: number }> {
    const { payments } = await import('../../../src/db/schema/payments.js');
    const { creditsTransactions } = await import('../../../src/db/schema/credits.js');

    const userPayments = await db.select().from(payments).where(eq(payments.userId, targetUserId));
    const userCreditsTx = await db.select().from(creditsTransactions).where(eq(creditsTransactions.userId, targetUserId));

    const totalPayments = userPayments.length;
    const totalTransactions = userCreditsTx.length;

    return {
        canDelete: totalPayments === 0 && totalTransactions === 0,
        totalPayments,
        totalTransactions
    };
}
