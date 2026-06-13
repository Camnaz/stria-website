import styles from "./Footer.module.css";
import { routes } from "../../utils/navigation";
import { useNavigate } from "react-router-dom";
import { BrandButton } from "./BrandButton";

export function Footer() {
  const navigate = useNavigate();
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

      <div className={styles.legalLinks} aria-label="Legal links">
        <button onClick={() => navigate(routes.legal)}>Legal</button>
        <button onClick={() => navigate(routes.privacy)}>Privacy Policy</button>
      </div>
    </footer>
  );
}
