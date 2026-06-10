import styles from "./Button.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "nav-cta";
  size?: "default" | "small";
}

export function Button({
  variant = "primary",
  size = "default",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const variantClass = variant === "primary" ? styles.primary : variant === "secondary" ? styles.secondary : styles.navCta;
  const sizeClass = size === "small" ? styles.small : "";

  return (
    <button className={`${styles.button} ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
}