import styles from "./BrandButton.module.css";
import { useNavigate } from "react-router-dom";
import { routes } from "../../utils/navigation";

interface BrandButtonProps {
  variant?: "header" | "footer";
}

export function BrandButton({ variant = "header" }: BrandButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      className={`${styles.brand} ${variant === "footer" ? styles.footerBrand : ""}`}
      onClick={() => navigate(routes.company)}
      aria-label="Stria Systems home"
    >
      <img
        className={styles.logo}
        src="/assets/striaSystems400.svg"
        alt="Stria Systems"
      />
    </button>
  );
}
