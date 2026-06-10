import { loadIdentity, loadPolicy, runTraceSimulation, samplePaymentDraftCall, withPaymentThresholdMode } from "./index.js";

const identity = await loadIdentity();
const basePolicy = await loadPolicy();
const call = samplePaymentDraftCall();

const observeResult = runTraceSimulation({
  identity,
  policy: withPaymentThresholdMode(basePolicy, "observe"),
  call,
});

const enforceResult = runTraceSimulation({
  identity,
  policy: withPaymentThresholdMode(basePolicy, "enforce"),
  call,
  previousRecordHash: observeResult.evidence_record.chain_of_custody.record_hash,
});

console.log(
  JSON.stringify(
    {
      thesis: "Before autonomous agents can act with authority, every action must be attributable, policy-evaluated, and permanently auditable.",
      simulations: {
        observe_mode: observeResult,
        enforce_mode: enforceResult,
      },
    },
    null,
    2,
  ),
);
