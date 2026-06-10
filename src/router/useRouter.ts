import { useEffect, useState } from "react";
import { getSurfaceFromPath, navigate } from "../utils/navigation";
import { routes } from "../types/router";
import type { Surface } from "../types/router";

export function useRouter(): [Surface, (path: string) => void] {
  const [surface, setSurface] = useState<Surface>(() => getSurfaceFromPath(window.location.pathname));

  useEffect(() => {
    const onPop = () => setSurface(getSurfaceFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return [surface, navigate];
}

export { routes, navigate, getSurfaceFromPath };
export type { Surface } from "../types/router";