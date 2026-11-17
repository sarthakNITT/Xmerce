import { createClerkClient } from "@clerk/backend";

export const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
export const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
export const clerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET || "";

export const clerkClient = createClerkClient({
  secretKey: clerkSecretKey,
  publishableKey: clerkPublishableKey,
});
