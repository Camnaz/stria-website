import { routes } from "../types/router";

export function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function getSurfaceFromPath(pathname: string): import("../types/router").Surface {
  if (pathname === "/docs") return "traceDocs";
  if (pathname === "/platform") return "platform";
  if (pathname === "/architecture") return "architecture";
  if (pathname === "/forge" || pathname.startsWith("/forge/")) return "forge";
  if (pathname === "/trace/documentation" || pathname === "/trace/docs") return "traceDocs";
  if (pathname === "/trace" || pathname.startsWith("/trace/")) return "trace";
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return "demo";
  return "company";
}