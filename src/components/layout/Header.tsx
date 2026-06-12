import styles from "./Header.module.css";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { routes } from "../../utils/navigation";
import { useLocation, useNavigate } from "react-router-dom";
import type { Surface } from "../../types/router";
import { BrandButton } from "./BrandButton";

interface HeaderProps {
  surface?: Surface;
}

export function Header({ surface }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const activeSurface = surface ?? surfaceFromPath(location.pathname);

  const goTo = (route: string) => {
    setIsMenuOpen(false);
    navigate(route);
  };

  useEffect(() => {
    let rafId = 0;
    const header = headerRef.current;
    if (!header) return;

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        header.classList.toggle(styles.isScrolled, window.scrollY > 20);
        rafId = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <header ref={headerRef} className={styles.header}>
      <BrandButton />

      <button
        className={styles.menuButton}
        type="button"
        aria-expanded={isMenuOpen}
        aria-controls="primary-navigation"
        aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        <span>Menu</span>
      </button>

      <nav id="primary-navigation" className={`${styles.nav} ${isMenuOpen ? styles.open : ""}`} aria-label="Primary navigation">
        <button className={activeSurface === "company" ? styles.active : ""} onClick={() => goTo(routes.company)}>
          Company
        </button>
        <button className={activeSurface === "platform" ? styles.active : ""} onClick={() => goTo(routes.platform)}>
          Platform
        </button>
        <button className={activeSurface === "trace" ? styles.active : ""} onClick={() => goTo(routes.trace)}>
          Trace
        </button>
        <button className={activeSurface === "forge" ? styles.active : ""} onClick={() => goTo(routes.forge)}>
          Forge
        </button>
        <button className={activeSurface === "architecture" ? styles.active : ""} onClick={() => goTo(routes.architecture)}>
          Architecture
        </button>
        <button className={activeSurface === "traceDocs" ? styles.active : ""} onClick={() => goTo(routes.traceDocs)}>
          Docs
        </button>
        <button className={styles.mobileCta} onClick={() => goTo(routes.demo)}>
          Request demo
        </button>
      </nav>

      <button className={styles.navCta} onClick={() => goTo(routes.demo)}>
        Request demo
      </button>
    </header>
  );
}

function surfaceFromPath(pathname: string): Surface {
  if (pathname.startsWith(routes.platform)) return "platform";
  if (pathname.startsWith(routes.traceDocs)) return "traceDocs";
  if (pathname.startsWith(routes.trace)) return "trace";
  if (pathname.startsWith(routes.forge)) return "forge";
  if (pathname.startsWith(routes.architecture)) return "architecture";
  if (pathname.startsWith(routes.demo)) return "demo";
  return "company";
}
