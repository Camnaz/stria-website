import styles from "./SourceQuote.module.css";

interface SourceQuoteProps {
  quote: string;
  attribution: string;
}

export function SourceQuote({ quote, attribution }: SourceQuoteProps) {
  return (
    <figure className={styles.quote}>
      <blockquote>{quote}</blockquote>
      <figcaption>{attribution}</figcaption>
    </figure>
  );
}