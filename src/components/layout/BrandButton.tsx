import styles from "./BrandButton.module.css";

interface BrandButtonProps {
  variant?: "header" | "footer";
}

export function BrandButton({ variant = "header" }: BrandButtonProps) {
  return (
    <button
      className={`${styles.brand} ${variant === "footer" ? styles.footerBrand : ""}`}
      onClick={() => window.location.href = "/"}
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
