import styles from "./Footer.module.css";
import { navigate, routes } from "../../utils/navigation";
import { BrandButton } from "./BrandButton";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <BrandButton variant="footer" />

      <nav className={styles.nav} aria-label="Footer navigation">
        <button onClick={() => navigate(routes.platform)}>Platform</button>
        <button onClick={() => navigate(routes.trace)}>Trace</button>
        <button onClick={() => navigate(routes.forge)}>Forge</button>
        <button onClick={() => navigate(routes.architecture)}>Architecture</button>
        <button onClick={() => navigate(routes.traceDocs)}>Docs</button>
        <button onClick={() => navigate(routes.demo)}>Demo</button>
      </nav>

      <span className={styles.credit}>Stria Systems</span>
    </footer>
  );
}