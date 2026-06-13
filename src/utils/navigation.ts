export { routes, routeMetadata, type RouteMetadata } from "../types/router";
export type { Surface } from "../types/router";

export function getSurfaceFromPath(pathname: string): import("../types/router").Surface {
  if (pathname === "/docs") return "traceDocs";
  if (pathname === "/platform") return "platform";
  if (pathname === "/architecture") return "architecture";
  if (pathname === "/forge" || pathname.startsWith("/forge/")) return "forge";
  if (pathname === "/trace/documentation" || pathname === "/trace/docs") return "traceDocs";
  if (pathname === "/trace" || pathname.startsWith("/trace/")) return "trace";
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return "demo";
  if (pathname === "/legal" || pathname.startsWith("/legal/")) return "legal";
  if (pathname === "/privacy" || pathname.startsWith("/privacy/")) return "privacy";
  return "company";
}
