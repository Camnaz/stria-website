import styles from "./SectionHeading.module.css";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, text, className = "" }: SectionHeadingProps) {
  return (
    <div className={`${styles.heading} ${className}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}