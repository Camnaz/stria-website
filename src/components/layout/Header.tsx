import styles from "./Header.module.css";
import { useEffect, useRef } from "react";
import { routes } from "../../utils/navigation";
import { useNavigate } from "react-router-dom";
import type { Surface } from "../../types/router";
import { BrandButton } from "./BrandButton";

interface HeaderProps {
  surface: Surface;
}

export function Header({ surface }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

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

      <nav className={styles.nav} aria-label="Primary navigation">
        <button className={surface === "company" ? styles.active : ""} onClick={() => navigate(routes.company)}>
          Company
        </button>
        <button className={surface === "platform" ? styles.active : ""} onClick={() => navigate(routes.platform)}>
          Platform
        </button>
        <button className={surface === "trace" ? styles.active : ""} onClick={() => navigate(routes.trace)}>
          Trace
        </button>
        <button className={surface === "forge" ? styles.active : ""} onClick={() => navigate(routes.forge)}>
          Forge
        </button>
        <button className={surface === "architecture" ? styles.active : ""} onClick={() => navigate(routes.architecture)}>
          Architecture
        </button>
        <button className={surface === "traceDocs" ? styles.active : ""} onClick={() => navigate(routes.traceDocs)}>
          Docs
        </button>
      </nav>

      <button className={styles.navCta} onClick={() => navigate(routes.demo)}>
        Request demo
      </button>
    </header>
  );
}