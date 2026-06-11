import styles from "./DocsResult.module.css";

interface DocsResultProps {
  label: string;
  result: string;
  allowed: string;
}

export function DocsResult({ label, result, allowed }: DocsResultProps) {
  return (
    <article className={styles.result}>
      <span>{label}</span>
      <strong>{result}</strong>
      <p>Action {allowed}; evidence record emitted.</p>
    </article>
  );
}