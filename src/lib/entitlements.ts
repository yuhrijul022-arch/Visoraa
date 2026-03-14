export interface UserEntitlementData {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    infinite_enabled: boolean;
    status: 'active' | 'suspended' | 'deleted';
}

export class EntitlementResolver {
    constructor(public user: UserEntitlementData) {}

    // Active plan means they have paid for something higher than 'free' and account is active
    get hasActivePlan(): boolean {
        return this.user.status === 'active' && this.user.plan !== 'free';
    }

    // Pro features
    get isPro(): boolean {
        return this.user.status === 'active' && (this.user.plan === 'pro' || this.user.plan === 'enterprise');
    }

    // Infinite access: Either PRO or specifically granted
    get canUseInfinite(): boolean {
        return this.user.status === 'active' && (this.isPro || this.user.infinite_enabled);
    }

    // Dashboard access: Must have an active status AND an active paid plan
    get canAccessDashboard(): boolean {
        return this.user.status === 'active' && this.hasActivePlan;
    }

    // Explicit check to block any deleted users just in case
    get isDeleted(): boolean {
        return this.user.status === 'deleted';
    }
}
