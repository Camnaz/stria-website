import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSurfaceFromPath } from "../utils/navigation";
import { routes } from "../types/router";
import type { Surface } from "../types/router";

export function useRouter(): [Surface, (path: string) => void] {
  const [surface, setSurface] = useState<Surface>(() => getSurfaceFromPath(window.location.pathname));
  const navigate = useNavigate();

  useEffect(() => {
    const onPop = () => setSurface(getSurfaceFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return [surface, navigate];
}

export { routes, getSurfaceFromPath };
export type { Surface } from "../types/router";