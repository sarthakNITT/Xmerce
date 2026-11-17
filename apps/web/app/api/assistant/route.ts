/**
 * Forwards a shopper message to the backend shopping assistant (AI-A).
 *
 * The browser calls this same-origin route, so the backend needs no CORS
 * setup and its address stays on the server.
 */
// AI service (apps/ai) runs separately on port 3002.
const BACKEND_URL = process.env.AI_SERVICE_URL ?? "http://localhost:3002";
const TIMEOUT_MS = 20_000;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/ai/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[assistant] backend unreachable:", error);
    return Response.json(
      { error: "The shopping assistant is unavailable right now." },
      { status: 503 },
    );
  }
}
