import { NextResponse } from "next/server";
import { getSubscriptionPlans } from "@/lib/subscription-plans";

export async function GET() {
  try {
    return NextResponse.json({ plans: getSubscriptionPlans() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription plan settings are invalid.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
