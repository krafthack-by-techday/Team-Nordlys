import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { config } from "./config";

export interface ScanResult {
  targets: string[];
  ports?: string;
  profile: "quick" | "standard" | "deep";
  raw_summary: string;
  hosts_up: number;
  open_ports: number;
  mock: boolean;
  duration_ms: number;
}

const PROFILE_FLAGS: Record<ScanResult["profile"], string[]> = {
  quick: ["-T4", "-F"],
  standard: ["-T4", "-sS"],
  deep: ["-T3", "-sV", "-O"],
};

export function runScan(input: {
  targets: readonly string[];
  ports?: string | undefined;
  profile: ScanResult["profile"];
}): ScanResult {
  const start = Date.now();
  const args: string[] = [...PROFILE_FLAGS[input.profile]];
  if (input.ports) args.push("-p", input.ports);
  args.push(...input.targets);

  let result: SpawnSyncReturns<string>;
  try {
    result = spawnSync("nmap", args, {
      encoding: "utf8",
      timeout: config.scanTimeoutMs,
    });
  } catch (err) {
    if (config.mockWhenMissing) {
      return mockResult(input, start, `spawn error: ${err}`);
    }
    throw err;
  }

  if (result.error || result.status !== 0) {
    if (config.mockWhenMissing && (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return mockResult(input, start, "nmap binary not found");
    }
    throw new Error(
      `nmap exited ${result.status}: ${result.stderr?.slice(0, 200) ?? ""}`,
    );
  }

  return parseNmap(input, result.stdout, start);
}

function parseNmap(
  input: { targets: readonly string[]; ports?: string | undefined; profile: ScanResult["profile"] },
  stdout: string,
  start: number,
): ScanResult {
  // Quick parse — counts up-hosts and open ports from the human-readable
  // output. XML output (-oX) gives a richer tree but for v1.0 the summary
  // is enough to drive an event title.
  const hostsUp = (stdout.match(/Host is up/g) ?? []).length;
  const openPorts = (stdout.match(/^\d+\/\w+\s+open/gm) ?? []).length;
  const summary = stdout.split("\n").slice(0, 10).join("\n");
  return {
    targets: [...input.targets],
    ...(input.ports !== undefined ? { ports: input.ports } : {}),
    profile: input.profile,
    raw_summary: summary,
    hosts_up: hostsUp,
    open_ports: openPorts,
    mock: false,
    duration_ms: Date.now() - start,
  };
}

function mockResult(
  input: { targets: readonly string[]; ports?: string | undefined; profile: ScanResult["profile"] },
  start: number,
  reason: string,
): ScanResult {
  return {
    targets: [...input.targets],
    ...(input.ports !== undefined ? { ports: input.ports } : {}),
    profile: input.profile,
    raw_summary: `[mock] ${reason}`,
    hosts_up: 0,
    open_ports: 0,
    mock: true,
    duration_ms: Date.now() - start,
  };
}
