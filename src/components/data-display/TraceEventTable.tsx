import { StatusPill } from "../ui";
import type { TraceEvent } from "../../types/platform";
import styles from "./TraceEventTable.module.css";

interface TraceEventTableProps {
  events: TraceEvent[];
}

export function TraceEventTable({ events }: TraceEventTableProps) {
  return (
    <div className={styles.table} role="table" aria-label="Trace event telemetry">
      <div className={`${styles.row} ${styles.head}`} role="row">
        <span>Event</span>
        <span>App</span>
        <span>Status</span>
        <span>Latency</span>
        <span>Cost</span>
      </div>
      {events.map((event) => (
        <div className={styles.row} role="row" key={event.id}>
          <span>{event.id}</span>
          <span>{event.app_id}</span>
          <span className={`${styles.statusPill} ${event.status}`}>{event.status}</span>
          <span>{event.latency_ms}ms</span>
          <span>${event.cost_estimate.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}