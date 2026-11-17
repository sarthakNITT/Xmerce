import { requireAuth } from "../middlewares/auth.middleware";
import { getUserByClerkId } from "../services/user.service";

export async function getProfile(req: Request): Promise<Response> {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const auth = authResult.auth!;
  const user = auth.user || (await getUserByClerkId(auth.userId));

  if (!user) {
    return Response.json({ error: "User record not found in database" }, { status: 404 });
  }

  return Response.json({
    success: true,
    user,
  });
}
