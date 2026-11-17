import { appConfig } from "../config/app";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Per-request state shared by router, middlewares and controllers. */
export interface RequestContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  /** Set-Cookie values appended to the final response. */
  setCookies: string[];
}

export function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, ...((data && typeof data === "object" && !Array.isArray(data)) ? data : { data }) }, { status });
}

export function errorResponse(status: number, message: string, code?: string): Response {
  return Response.json({ success: false, error: message, ...(code ? { code } : {}) }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as T;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object", "INVALID_JSON");
  }
}

// ---------- cookies ----------

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  // Cross-site frontends in production need SameSite=None; Secure.
  // localhost:3000 -> localhost:4000 is same-site, so Lax works in dev.
  const sameSite = appConfig.isProduction ? "None; Secure" : "Lax";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=${sameSite}`;
}

// ---------- CORS ----------

export function applyCors(req: Request, res: Response): Response {
  const origin = req.headers.get("origin");
  if (origin && appConfig.corsOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function preflight(req: Request): Response {
  const res = new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Guest-Id, svix-id, svix-timestamp, svix-signature",
      "Access-Control-Max-Age": "600",
    },
  });
  return applyCors(req, res);
}

// ---------- small validators ----------

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `"${field}" is required`, "VALIDATION_ERROR");
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(400, `"${field}" must be at most ${max} characters`, "VALIDATION_ERROR");
  }
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 200): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireString(value, field, max);
}

export function requireInt(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `"${field}" must be an integer between ${min} and ${max}`, "VALIDATION_ERROR");
  }
  return n;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
