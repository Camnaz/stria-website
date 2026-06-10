import styles from "./ConsoleEvent.module.css";

interface ConsoleEventProps {
  id: string;
  system: string;
  status: string;
  detail: string;
}

export function ConsoleEvent({ id, system, status, detail }: ConsoleEventProps) {
  return (
    <div className={styles.event}>
      <strong>{id}</strong>
      <span>{system}</span>
      <b>{status}</b>
      <small>{detail}</small>
    </div>
  );
}