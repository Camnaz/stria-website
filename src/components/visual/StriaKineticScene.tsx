import styles from "./StriaKineticScene.module.css";
interface StriaKineticSceneProps {
  className?: string;
}

export function StriaKineticScene({ className = "" }: StriaKineticSceneProps) {
  return (
    <div className={`${styles.scene} ${className}`} aria-hidden="true">
      <div className={styles.ringOne} />
      <div className={styles.ringTwo} />
      <div className={styles.pathOne} />
      <div className={styles.pathTwo} />
    </div>
  );
}
