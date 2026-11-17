import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Step 1 of the admin guard: /admin requires a signed-in Clerk session
// (guests are redirected to /sign-in). Step 2, the ADMIN role check, runs in
// app/admin/layout.tsx because the role lives in our database, and the backend
// checks it again on every /api/admin request.
export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
