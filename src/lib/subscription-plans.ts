export const SUBSCRIPTION_PLAN_KEYS = ["weekly", "monthly", "termly", "yearly"] as const;

export type SubscriptionPlanKey = (typeof SUBSCRIPTION_PLAN_KEYS)[number];

export type SubscriptionPlan = {
  key: SubscriptionPlanKey;
  name: string;
  durationDays: number;
  amountKes: number | null;
};

export type ConfiguredSubscriptionPlan = SubscriptionPlan & { amountKes: number };

const planSettings: Record<SubscriptionPlanKey, { name: string; amountEnv: string; durationEnv: string; defaultDays: number }> = {
  weekly: { name: "Weekly", amountEnv: "SUBSCRIPTION_WEEKLY_AMOUNT_KES", durationEnv: "SUBSCRIPTION_WEEKLY_DAYS", defaultDays: 7 },
  monthly: { name: "Monthly", amountEnv: "SUBSCRIPTION_MONTHLY_AMOUNT_KES", durationEnv: "SUBSCRIPTION_MONTHLY_DAYS", defaultDays: 30 },
  termly: { name: "Termly", amountEnv: "SUBSCRIPTION_TERMLY_AMOUNT_KES", durationEnv: "SUBSCRIPTION_TERMLY_DAYS", defaultDays: 90 },
  yearly: { name: "Yearly", amountEnv: "SUBSCRIPTION_YEARLY_AMOUNT_KES", durationEnv: "SUBSCRIPTION_YEARLY_DAYS", defaultDays: 365 },
};

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return SUBSCRIPTION_PLAN_KEYS.map((key) => {
    const settings = planSettings[key];
    const rawAmount = process.env[settings.amountEnv];
    const rawDuration = process.env[settings.durationEnv];
    const amountKes = rawAmount ? Number(rawAmount) : null;
    const durationDays = rawDuration ? Number(rawDuration) : settings.defaultDays;
    if (rawAmount && (!Number.isInteger(amountKes) || Number(amountKes) <= 0)) {
      throw new Error(`${settings.amountEnv} must be a positive whole number of Kenyan shillings.`);
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      throw new Error(`${settings.durationEnv} must be an integer between 1 and 3650.`);
    }
    return {
      key,
      name: settings.name,
      durationDays,
      amountKes,
    };
  });
}

export function getSubscriptionPlan(key: string): ConfiguredSubscriptionPlan {
  if (!(SUBSCRIPTION_PLAN_KEYS as readonly string[]).includes(key)) {
    throw new Error("Choose a valid subscription plan.");
  }
  const plan = getSubscriptionPlans().find((item) => item.key === key);
  if (!plan) throw new Error("The selected subscription plan is unavailable.");
  const amountKes = plan.amountKes;
  if (amountKes === null) {
    throw new Error(`${plan.name} pricing has not been configured yet.`);
  }
  return { ...plan, amountKes };
}
