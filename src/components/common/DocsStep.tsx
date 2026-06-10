import styles from "./DocsStep.module.css";

interface DocsStepProps {
  number: string;
  title: string;
  text: string;
}

export function DocsStep({ number, title, text }: DocsStepProps) {
  return (
    <article className={styles.step}>
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}