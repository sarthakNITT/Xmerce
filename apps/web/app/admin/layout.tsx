import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

/**
 * Step 2 of the admin guard (step 1 is proxy.ts): asks the backend whether the
 * signed-in user has role ADMIN. Only admins get the panel rendered; everyone
 * else sees an access-denied page and never receives the admin UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  try {
    await api<{ user: { role: string } }>("/api/admin/me", await getToken());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/sign-in");
    const message =
      err instanceof ApiError && err.status === 403
        ? "Your account doesn't have admin access."
        : "Couldn't reach the backend to verify admin access. Is it running?";
    return (
      <main className={styles.denied}>
        <h1>Access denied</h1>
        <p>{message}</p>
      </main>
    );
  }

  return <div className={styles.shell}>{children}</div>;
}
