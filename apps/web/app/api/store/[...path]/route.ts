import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin proxy to apps/backend for everything tied to the shopper
 * (cart, checkout, orders, profile, recommendations).
 *
 * Why: calling the backend straight from the browser relied on the Clerk token
 * being ready on window.Clerk and on a cross-port cookie. When either was
 * missing the backend saw a guest, so carts were saved with userId = NULL.
 * Here the Clerk session is read on the server and the guest cookie is
 * first-party for localhost:3000.
 */
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const FORWARD_HEADERS = ['content-type', 'accept', 'cookie', 'x-guest-id'];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${BACKEND}/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json({ success: false, error: 'Store service is unavailable', code: 'BACKEND_DOWN' }, { status: 502 });
  }

  const res = new NextResponse(upstream.body, { status: upstream.status });
  const type = upstream.headers.get('content-type');
  if (type) res.headers.set('content-type', type);
  for (const cookie of upstream.headers.getSetCookie()) res.headers.append('set-cookie', cookie);
  return res;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
