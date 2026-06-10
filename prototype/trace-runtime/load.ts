import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AgentIdentity, PolicySpec } from "./types.js";

export async function loadIdentity(path = "examples/identity.yaml"): Promise<AgentIdentity> {
  return parse(await readFile(path, "utf8")) as AgentIdentity;
}

export async function loadPolicy(path = "examples/policy.yaml"): Promise<PolicySpec> {
  return parse(await readFile(path, "utf8")) as PolicySpec;
}
