import type { RequestContext } from "./http";

export type Handler = (ctx: RequestContext) => Promise<Response> | Response;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

/** Minimal router: static segments and `:param` segments, matched in registration order. */
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    this.routes.push({ method, segments: split(path), handler });
    return this;
  }
  get(path: string, h: Handler) { return this.add("GET", path, h); }
  post(path: string, h: Handler) { return this.add("POST", path, h); }
  patch(path: string, h: Handler) { return this.add("PATCH", path, h); }
  delete(path: string, h: Handler) { return this.add("DELETE", path, h); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = split(pathname);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i]!;
        const part = parts[i]!;
        if (seg.startsWith(":")) {
          params[seg.slice(1)] = decodeURIComponent(part);
        } else if (seg !== part) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}
