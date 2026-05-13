import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Severity } from "@nordlys/contracts";

// A scenario describes a deterministic mapping from raw SIEM input to a
// Nordlys event template. Matching is intentionally simple in v1.0 —
// substring or regex on declared fields. Aggregation and shadow-mode-by-
// scenario can be added in v1.1 without changing the file format.

export interface ScenarioMatcher {
  field: string; // dot-path into the input object, e.g. "alert.signature"
  contains?: string;
  equals?: string;
  regex?: string;
}

export interface Scenario {
  id: string;
  name: string;
  severity: Severity;
  shadow?: boolean; // skip forwarding to core-svc, just log
  match: ScenarioMatcher[]; // ALL must match for the scenario to fire
  title_template?: string; // event title; supports `{field.path}` interpolation
  description_template?: string;
}

let scenarios: Scenario[] = [];

export async function loadScenarios(dir: string): Promise<Scenario[]> {
  scenarios = [];
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    console.log(`[collector-svc] no scenarios dir at ${dir} — running open`);
    return scenarios;
  }
  for (const file of files) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    try {
      const text = await readFile(join(dir, file), "utf8");
      const parsed = parseYaml(text);
      const list: Scenario[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const s of list) {
        if (validateScenario(s)) scenarios.push(s);
        else console.warn(`[collector-svc] skipping invalid scenario in ${file}`);
      }
    } catch (err) {
      console.warn(`[collector-svc] failed to load ${file}:`, err);
    }
  }
  console.log(`[collector-svc] loaded ${scenarios.length} scenarios from ${dir}`);
  return scenarios;
}

export function getScenarios(): readonly Scenario[] {
  return scenarios;
}

export interface ScenarioMatch {
  scenario: Scenario;
  title: string;
  description: string;
}

export function matchScenario(input: unknown): ScenarioMatch | null {
  for (const scenario of scenarios) {
    if (allMatchersHit(scenario.match, input)) {
      return {
        scenario,
        title: interpolate(scenario.title_template ?? scenario.name, input),
        description: interpolate(scenario.description_template ?? "", input),
      };
    }
  }
  return null;
}

function allMatchersHit(
  matchers: ScenarioMatcher[],
  input: unknown,
): boolean {
  if (matchers.length === 0) return false;
  for (const m of matchers) {
    const value = readPath(input, m.field);
    if (value === undefined) return false;
    if (!matcherHits(m, String(value))) return false;
  }
  return true;
}

function matcherHits(m: ScenarioMatcher, value: string): boolean {
  if (m.contains !== undefined) return value.includes(m.contains);
  if (m.equals !== undefined) return value === m.equals;
  if (m.regex !== undefined) {
    try {
      return new RegExp(m.regex).test(value);
    } catch {
      return false;
    }
  }
  return false;
}

function readPath(input: unknown, path: string): unknown {
  let cursor: unknown = input;
  for (const part of path.split(".")) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function interpolate(template: string, input: unknown): string {
  return template.replace(/\{([^}]+)\}/g, (_, path: string) => {
    const value = readPath(input, path.trim());
    return value === undefined ? "" : String(value);
  });
}

function validateScenario(s: unknown): s is Scenario {
  if (!s || typeof s !== "object") return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.severity === "string" &&
    Array.isArray(r.match)
  );
}
