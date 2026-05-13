import { describe, expect, test, beforeAll } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadScenarios, matchScenario, getScenarios } from "./scenarios";

// Helper: build a minimal YAML scenario file string
function yamlScenario(id: string, field: string, contains: string, severity = "medium"): string {
  return `- id: "${id}"
  name: "Scenario ${id}"
  severity: "${severity}"
  match:
    - field: "${field}"
      contains: "${contains}"
  title_template: "Alert: {${field}}"
`;
}

let scenariosDir: string;

beforeAll(async () => {
  scenariosDir = await mkdtemp(join(tmpdir(), "nordlys-test-"));
  // brute-force attack scenario
  await writeFile(
    join(scenariosDir, "brute.yaml"),
    yamlScenario("brute-force", "alert.signature", "brute force", "high"),
  );
  // SQL injection scenario
  await writeFile(
    join(scenariosDir, "sqli.yaml"),
    yamlScenario("sqli", "alert.signature", "SQL injection", "critical"),
  );
  await loadScenarios(scenariosDir);
});

describe("loadScenarios", () => {
  test("loads YAML files from the given directory", () => {
    const loaded = getScenarios();
    expect(loaded.length).toBeGreaterThanOrEqual(2);
  });

  test("returns empty list for a non-existent directory", async () => {
    const result = await loadScenarios("/tmp/nordlys-nonexistent-dir-99999");
    expect(result).toEqual([]);
  });

  test("ignores non-YAML files in the directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nordlys-mixed-"));
    await writeFile(join(dir, "notes.txt"), "ignore me");
    await writeFile(join(dir, "valid.yaml"), yamlScenario("x1", "event.type", "login"));
    const result = await loadScenarios(dir);
    expect(result.length).toBe(1);
    await rm(dir, { recursive: true });
  });
});

describe("matchScenario", () => {
  // Reload scenarios pointing to our main test dir before matching tests
  beforeAll(async () => {
    await loadScenarios(scenariosDir);
  });

  test("returns null when no scenarios match", () => {
    const result = matchScenario({ alert: { signature: "benign traffic" } });
    expect(result).toBeNull();
  });

  test("matches a scenario on contains field", () => {
    const result = matchScenario({ alert: { signature: "detected brute force attempt" } });
    expect(result).not.toBeNull();
    expect(result!.scenario.id).toBe("brute-force");
    expect(result!.scenario.severity).toBe("high");
  });

  test("matches SQL injection scenario on correct payload", () => {
    const result = matchScenario({ alert: { signature: "SQL injection via POST" } });
    expect(result).not.toBeNull();
    expect(result!.scenario.id).toBe("sqli");
    expect(result!.scenario.severity).toBe("critical");
  });

  test("interpolates title_template with input values", () => {
    const result = matchScenario({ alert: { signature: "brute force on SSH" } });
    expect(result).not.toBeNull();
    // title_template is "Alert: {alert.signature}"
    expect(result!.title).toContain("brute force on SSH");
  });

  test("returns null when required field is missing from input", () => {
    // Field path doesn't exist in input object
    const result = matchScenario({ network: { proto: "tcp" } });
    expect(result).toBeNull();
  });

  test("regex matcher fires on pattern match", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nordlys-regex-"));
    await writeFile(
      join(dir, "regex.yaml"),
      `- id: "regex-test"
  name: "Regex Scenario"
  severity: "low"
  match:
    - field: "msg"
      regex: "^ERR[0-9]+"
`,
    );
    const scenarios = await loadScenarios(dir);
    // Load this as a fresh set by re-calling loadScenarios — it resets the module state
    const match = matchScenario({ msg: "ERR404 not found" });
    expect(scenarios.length).toBe(1);
    expect(match).not.toBeNull();
    expect(match!.scenario.id).toBe("regex-test");
    await rm(dir, { recursive: true });
  });

  test("equals matcher fires only on exact match", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nordlys-equals-"));
    await writeFile(
      join(dir, "equals.yaml"),
      `- id: "equals-test"
  name: "Equals Scenario"
  severity: "low"
  match:
    - field: "status"
      equals: "critical"
`,
    );
    await loadScenarios(dir);
    expect(matchScenario({ status: "critical" })).not.toBeNull();
    expect(matchScenario({ status: "critical-ish" })).toBeNull();
    await rm(dir, { recursive: true });
  });

  test("all matchers must hit — partial match returns null", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nordlys-multi-"));
    await writeFile(
      join(dir, "multi.yaml"),
      `- id: "multi-test"
  name: "Multi Scenario"
  severity: "high"
  match:
    - field: "alert.type"
      equals: "intrusion"
    - field: "alert.severity"
      equals: "high"
`,
    );
    await loadScenarios(dir);
    // Only first matcher satisfies
    expect(matchScenario({ alert: { type: "intrusion", severity: "low" } })).toBeNull();
    // Both matchers satisfy
    expect(matchScenario({ alert: { type: "intrusion", severity: "high" } })).not.toBeNull();
    await rm(dir, { recursive: true });
  });
});
