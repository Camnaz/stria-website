import { useScroll3D } from "../../hooks/useScrollAnimation";
import styles from "./FlowDiagram.module.css";

interface FlowDiagramProps {
  steps: string[];
}

export function FlowDiagram({ steps }: FlowDiagramProps) {
  const { ref, isInView } = useScroll3D();

  return (
    <ol ref={ref} className={`${styles.diagram} ${styles.scroll3dList} ${isInView ? "is-in-view" : ""}`} aria-label="Trace execution flow">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}