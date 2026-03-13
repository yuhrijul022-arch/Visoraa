import { eq } from 'drizzle-orm';
import { db } from '../../../src/lib/db';
import { infiniteUsage } from '../../../src/db/schema/infiniteUsage';

export const DAILY_LIMIT = 30;
export const LIFETIME_LIMIT = 1000;

export async function checkAndIncrementInfiniteUsage(userId: string): Promise<{
    allowed: boolean;
    errorType?: 'DAILY_LIMIT_REACHED' | 'LIFETIME_LIMIT_REACHED';
}> {
    await db.transaction(async (tx) => {
        // Ensure record exists
        let usage = await tx.query.infiniteUsage.findFirst({ where: eq(infiniteUsage.userId, userId) });
        
        if (!usage) {
            await tx.insert(infiniteUsage).values({
                userId,
                dailyCount: 0,
                lifetimeCount: 0,
                dailyResetAt: new Date()
            });
            usage = await tx.query.infiniteUsage.findFirst({ where: eq(infiniteUsage.userId, userId) });
        }

        if (!usage) throw new Error("Could not initialize infinite usage");

        // Lifetime check
        if (usage.lifetimeCount >= LIFETIME_LIMIT) {
            throw new Error('LIFETIME_LIMIT_REACHED');
        }

        // Daily check
        if (usage.dailyCount >= DAILY_LIMIT) {
            throw new Error('DAILY_LIMIT_REACHED');
        }

        // Increment
        await tx.update(infiniteUsage).set({
            dailyCount: usage.dailyCount + 1,
            lifetimeCount: usage.lifetimeCount + 1
        }).where(eq(infiniteUsage.userId, userId));
    }).catch(e => {
        if (e.message === 'LIFETIME_LIMIT_REACHED') throw { type: 'LIFETIME_LIMIT_REACHED' };
        if (e.message === 'DAILY_LIMIT_REACHED') throw { type: 'DAILY_LIMIT_REACHED' };
        throw e;
    });

    return { allowed: true };
}

export async function getInfiniteStatus(userId: string) {
    let usage = await db.query.infiniteUsage.findFirst({ where: eq(infiniteUsage.userId, userId) });
    if (!usage) {
        return {
            dailyCount: 0,
            lifetimeCount: 0,
            dailyLimit: DAILY_LIMIT,
            lifetimeLimit: LIFETIME_LIMIT
        };
    }
    return {
        dailyCount: usage.dailyCount,
        lifetimeCount: usage.lifetimeCount,
        dailyLimit: DAILY_LIMIT,
        lifetimeLimit: LIFETIME_LIMIT
    };
}
