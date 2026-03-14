import { db } from '../db.js';
import { payments } from '../../../src/db/schema/payments.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function userHasPendingPayment(userId: string): Promise<boolean> {
    const latestPending = await db
        .select({ createdAt: payments.createdAt })
        .from(payments)
        .where(
            and(
                eq(payments.userId, userId),
                inArray(payments.status, ['pending', 'waiting', 'unpaid'] as any[])
            )
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

    if (latestPending.length === 0) return false;

    // Safety: ignore pending payments older than 24h
    const payment = latestPending[0];
    if (payment.createdAt) {
        const ageMs = Date.now() - new Date(payment.createdAt).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) return false;
    }
    
    return true;
}
