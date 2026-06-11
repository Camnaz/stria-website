import styles from "./SiteShell.module.css";
import { Header } from "./Header";
import { Footer } from "./Footer";
import type { Surface } from "../../types/router";

interface SiteShellProps {
  children: React.ReactNode;
  surface: Surface;
}

export function SiteShell({ children, surface }: SiteShellProps) {
  return (
    <div className={`${styles.shell} ${styles[`surface${surface.charAt(0).toUpperCase() + surface.slice(1)}`]}`} data-surface={surface}>
      <Header surface={surface} />
      {children}
      <Footer />
    </div>
  );
}