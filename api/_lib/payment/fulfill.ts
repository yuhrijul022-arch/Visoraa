import { eq } from "drizzle-orm";
import { db } from "../db";
import { payments, users, creditsTransactions, infiniteUsage } from '../../../src/db/schema/index';

export async function fulfillPayment(orderId: string, gatewayResponse: any) {
  // 1. Get transaction
  const paymentRecord = await db.query.payments.findFirst({
    where: eq(payments.orderId, orderId),
  });

  if (!paymentRecord) {
    console.error(`fulfillPayment: Order ID ${orderId} not found in DB`);
    return;
  }

  if (paymentRecord.status === "paid") {
    console.log(`fulfillPayment: Order ID ${orderId} is already paid. Idempotent return.`);
    return;
  }

  const userId = paymentRecord.userId;
  if (!userId) {
    console.error(`fulfillPayment: No user ID attached to order ${orderId}`);
    // Mark as paid anyway to prevent infinite loop but note missing user
    await db.update(payments).set({
      status: "paid",
      gatewayResponse,
      webhookReceivedAt: new Date(),
    }).where(eq(payments.orderId, orderId));
    return;
  }

  // Get current user state
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    console.error(`fulfillPayment: User ${userId} not found`);
    return;
  }

  const currentBalance = user.credits;
  let creditsToAdd = 0;
  let creditType: "topup" | "welcome" | "bonus" | "generate_standard" | "generate_pro" = "topup";
  
  let newPlan = user.plan;
  let newInfiniteEnabled = user.infiniteEnabled;
  let updatePlanActivatedAt = false;

  // 2. Evaluate logic rules based on Implementation Plan Phase 1 Requirements
  const type = paymentRecord.type;
  
  if (type === "plan" && paymentRecord.planType === "basic") {
    newPlan = "basic";
    updatePlanActivatedAt = true;
    creditsToAdd = 250;
    creditType = "welcome";
  } else if (type === "plan" && paymentRecord.planType === "pro") {
    if (user.plan === "basic") {
      // Upgrade scenario: Basic -> Pro
      newPlan = "pro";
      newInfiniteEnabled = true;
      creditsToAdd = 150; // 400 - 250
      creditType = "bonus";
      // We don't necessarily update planActivatedAt again, but doing so is fine or preserving it.
    } else {
      // Direct Pro purchase
      newPlan = "pro";
      newInfiniteEnabled = true;
      creditsToAdd = 400;
      creditType = "welcome";
      updatePlanActivatedAt = true;
    }
  } else if (type === "topup") {
    creditsToAdd = paymentRecord.creditsAmount || 0;
    creditType = "topup";
  } else if (type === "infinite_extend") {
    // We handle infinite usage resetting below
    creditsToAdd = 0;
  }

  const newBalance = currentBalance + creditsToAdd;

  // 3. Execute DB Updates in a transaction
  await db.transaction(async (tx) => {
    // Update payment record
    await tx.update(payments).set({
      status: "paid",
      gatewayResponse,
      webhookReceivedAt: new Date(),
    }).where(eq(payments.orderId, orderId));

    // Update User
    const userUpdate: any = {
      plan: newPlan,
      infiniteEnabled: newInfiniteEnabled,
      credits: newBalance,
      updatedAt: new Date(),
    };
    if (updatePlanActivatedAt) {
      userUpdate.planActivatedAt = new Date();
    }
    await tx.update(users).set(userUpdate).where(eq(users.id, userId));

    // Insert Credit Transaction if credits were added
    if (creditsToAdd > 0) {
      await tx.insert(creditsTransactions).values({
        userId,
        type: creditType,
        amount: creditsToAdd,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        meta: { orderId },
      });
    }

    // Handle Infinite Extend logic
    if (type === "infinite_extend") {
      const existingUsage = await tx.query.infiniteUsage.findFirst({
        where: eq(infiniteUsage.userId, userId),
      });
      if (existingUsage) {
        await tx.update(infiniteUsage).set({
          lifetimeCount: 0,
          lifetimeLimitExtendedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(infiniteUsage.userId, userId));
      } else {
        await tx.insert(infiniteUsage).values({
          userId,
          lifetimeCount: 0,
          dailyCount: 0,
          dailyResetAt: new Date(),
          lifetimeLimitExtendedAt: new Date(),
        });
      }
    }
  });

  console.log(`fulfillPayment: Successfully fulfilled order ${orderId} for user ${userId}`);
}
