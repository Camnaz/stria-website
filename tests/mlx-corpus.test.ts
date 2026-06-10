import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function hashFile(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("Trace MLX corpus builder", () => {
  it("builds a deterministic local-only corpus with all split files present", () => {
    const outputA = mkdtempSync(join(tmpdir(), "trace-mlx-a-"));
    const outputB = mkdtempSync(join(tmpdir(), "trace-mlx-b-"));

    execFileSync("python3", ["prototype/mlx-classifier/build_enterprise_corpus.py", "--local-only", "--output-dir", outputA], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    execFileSync("python3", ["prototype/mlx-classifier/build_enterprise_corpus.py", "--local-only", "--output-dir", outputB], {
      cwd: process.cwd(),
      stdio: "pipe",
    });

    const summary = JSON.parse(readFileSync(join(outputA, "summary.json"), "utf8"));
    expect(summary.total_examples).toBeGreaterThan(200);
    expect(summary.splits.train).toBeGreaterThan(0);
    expect(summary.splits.valid).toBeGreaterThan(0);
    expect(summary.splits.test).toBeGreaterThan(0);
    expect(summary.label_distribution.risk_level.high).toBeGreaterThan(0);
    expect(summary.label_distribution.risk_level.medium).toBeGreaterThan(0);
    expect(summary.label_distribution.risk_level.low).toBeGreaterThan(0);
    expect(summary.label_distribution.intent_classification.potentially_malicious_or_unsafe).toBeGreaterThan(0);
    expect(hashFile(join(outputA, "train.jsonl"))).toBe(hashFile(join(outputB, "train.jsonl")));
    expect(hashFile(join(outputA, "valid.jsonl"))).toBe(hashFile(join(outputB, "valid.jsonl")));
    expect(hashFile(join(outputA, "test.jsonl"))).toBe(hashFile(join(outputB, "test.jsonl")));
  });

  it("scores a deterministic baseline against the held-out corpus split", () => {
    const output = mkdtempSync(join(tmpdir(), "trace-mlx-baseline-"));

    execFileSync("python3", ["prototype/mlx-classifier/build_enterprise_corpus.py", "--local-only", "--output-dir", output], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    execFileSync("python3", ["prototype/mlx-classifier/baseline_predict_usage.py", "--input", join(output, "test.jsonl"), "--output", join(output, "baseline.jsonl")], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    execFileSync(
      "python3",
      [
        "prototype/mlx-classifier/evaluate_usage_labels.py",
        "--labels",
        join(output, "test.jsonl"),
        "--predictions",
        join(output, "baseline.jsonl"),
        "--output",
        join(output, "baseline-report.json"),
        "--min-high-risk-recall",
        "0.8",
      ],
      {
        cwd: process.cwd(),
        stdio: "pipe",
      },
    );

    const report = JSON.parse(readFileSync(join(output, "baseline-report.json"), "utf8"));
    expect(existsSync(join(output, "baseline.jsonl"))).toBe(true);
    expect(report.examples).toBeGreaterThan(0);
    expect(report.high_risk.recall).toBeGreaterThanOrEqual(0.8);
    expect(report.accuracy.risk_level).toBeGreaterThan(0.6);
  });
});
