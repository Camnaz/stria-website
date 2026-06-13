import styles from "./SectionHeading.module.css";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
}

export function SectionHeading({ eyebrow: _eyebrow, title, text, className = "" }: SectionHeadingProps) {
  return (
    <div className={`${styles.heading} ${className}`}>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
