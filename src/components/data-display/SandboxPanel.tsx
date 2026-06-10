import { MetricTile } from "../ui";
import type { EvaluationRun } from "../../types/platform";
import styles from "./SandboxPanel.module.css";

interface SandboxPanelProps {
  activeRun: EvaluationRun;
}

export function SandboxPanel({ activeRun }: SandboxPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>
        <span>Sandbox execution</span>
        <strong>Run generated or uploaded code against deterministic test cases before deployment.</strong>
      </div>
      <div className={styles.console}>
        <div className={styles.consoleHeader}>
          <span>{activeRun.id}</span>
          <strong>{activeRun.status}</strong>
        </div>
        <pre>{activeRun.logs.map((log) => `✓ ${log}`).join("\n")}</pre>
      </div>
      <div className={styles.metrics}>
        <MetricTile label="Passed" value={String(activeRun.tests_passed)} />
        <MetricTile label="Failed" value={String(activeRun.tests_failed)} />
        <MetricTile label="Latency" value={`${activeRun.latency_ms}ms`} />
        <MetricTile label="Reward" value={String(activeRun.reward_score)} />
      </div>
    </div>
  );
}