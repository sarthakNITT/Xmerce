import { Webhook } from "svix";
import { clerkWebhookSecret } from "../config/clerk";
import { upsertUser, deleteUserByClerkId } from "../services/user.service";

export async function handleClerkWebhook(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  // If testing locally without a webhook secret or with dummy signature
  if (process.env.NODE_ENV !== "production" && (!clerkWebhookSecret || svix_signature === "v1,test")) {
    const event = JSON.parse(body);
    return await processEvent(event);
  }

  if (!clerkWebhookSecret) {
    return Response.json({ error: "CLERK_WEBHOOK_SECRET is not configured" }, { status: 500 });
  }

  let event: any;
  try {
    const wh = new Webhook(clerkWebhookSecret);
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    return Response.json({ error: "Invalid webhook signature: " + err.message }, { status: 400 });
  }

  return await processEvent(event);
}

async function processEvent(event: any): Promise<Response> {
  const eventType = event.type;
  const data = event.data;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const email = data.email_addresses?.[0]?.email_address || "";
      const username = data.username || null;
      const firstName = data.first_name || null;
      const lastName = data.last_name || null;
      const avatarUrl = data.image_url || data.profile_image_url || null;
      
      // Determine provider (OAuth Google vs Credentials)
      const primaryEmail = data.email_addresses?.[0];
      const verificationStrategy = primaryEmail?.verification?.strategy || "";
      const isGoogleOAuth = data.external_accounts?.some((acc: any) => acc.provider === "google") || verificationStrategy.includes("oauth_google");
      const authProvider = isGoogleOAuth ? "oauth_google" : "credentials";

      await upsertUser({
        clerkId: data.id,
        email,
        username,
        firstName,
        lastName,
        avatarUrl,
        authProvider,
      });

      return Response.json({ success: true, message: `User ${eventType} synced to DB` });
    }

    if (eventType === "user.deleted") {
      if (data.id) {
        await deleteUserByClerkId(data.id);
      }
      return Response.json({ success: true, message: "User deleted from DB" });
    }

    return Response.json({ success: true, message: "Event ignored" });
  } catch (err: any) {
    console.error("Error processing webhook:", err);
    return Response.json({ error: "Database sync failed: " + err.message }, { status: 500 });
  }
}
