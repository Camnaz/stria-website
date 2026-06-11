import styles from "./Button.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "nav-cta";
  size?: "default" | "small";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "default",
  fullWidth = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const variantClass = variant === "primary" ? styles.primary : variant === "secondary" ? styles.secondary : styles.navCta;
  const sizeClass = size === "small" ? styles.small : "";
  const widthClass = fullWidth ? styles.fullWidth : "";

  return (
    <button className={`${styles.button} ${variantClass} ${sizeClass} ${widthClass} ${className}`} {...props}>
      {children}
    </button>
  );
}