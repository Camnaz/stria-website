import { traceEvents } from "../../striaPlatformData";
import styles from "./TraceEventTable.module.css";

export function TraceEventTable() {
  return (
    <table className={styles.table} aria-label="Trace event telemetry">
      <thead>
        <tr>
          <th>EVENT</th>
          <th>APP</th>
          <th>STATUS</th>
          <th>LATENCY</th>
          <th>COST</th>
        </tr>
      </thead>
      <tbody>
        {traceEvents.map((event) => (
          <tr key={event.id}>
            <td><code>{event.id}</code></td>
            <td>{event.app_id}</td>
            <td><span className={`${styles.status} ${styles[event.status]}`}>{event.status.toUpperCase()}</span></td>
            <td>{event.latency_ms}ms</td>
            <td>${event.cost_estimate.toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}