import styles from "./ModeGrid.module.css";
import { ModeColumn } from "../../components/common";

interface ModeGridProps {
  columns: { title: string; items: string[] }[];
  className?: string;
}

export function ModeGrid({ columns, className = "" }: ModeGridProps) {
  return (
    <div className={`${styles.grid} ${className}`}>
      {columns.map((col, i) => (
        <ModeColumn key={i} title={col.title} items={col.items} />
      ))}
    </div>
  );
}