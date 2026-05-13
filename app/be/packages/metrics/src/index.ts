// Minimal Prometheus exposition format renderer.
// No runtime dependencies — produces text/plain; version=0.0.4 output.
//
// Spec: https://prometheus.io/docs/instrumenting/exposition_formats/

export type Labels = Record<string, string>;

// ── helpers ───────────────────────────────────────────────────────────────

function labelKey(labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return "__none__";
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k] ?? ""}`)
    .join("\x00"); // null-sep to avoid collisions with label values
}

function renderLabels(labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return "";
  const pairs = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${escapeLabel(labels[k] ?? "")}"`);
  return `{${pairs.join(",")}}`;
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ── Counter ───────────────────────────────────────────────────────────────

export class Counter {
  readonly name: string;
  readonly help: string;
  private readonly counts = new Map<string, number>();
  private readonly labelMap = new Map<string, Labels | undefined>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels?: Labels, amount = 1): void {
    const key = labelKey(labels);
    this.counts.set(key, (this.counts.get(key) ?? 0) + amount);
    if (!this.labelMap.has(key)) this.labelMap.set(key, labels);
  }

  value(labels?: Labels): number {
    return this.counts.get(labelKey(labels)) ?? 0;
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.counts.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, val] of this.counts) {
        const labels = this.labelMap.get(key);
        lines.push(`${this.name}${renderLabels(labels)} ${val}`);
      }
    }
    return lines.join("\n");
  }
}

// ── Gauge ─────────────────────────────────────────────────────────────────

export class Gauge {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();
  private readonly labelMap = new Map<string, Labels | undefined>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(value: number, labels?: Labels): void {
    const key = labelKey(labels);
    this.values.set(key, value);
    if (!this.labelMap.has(key)) this.labelMap.set(key, labels);
  }

  inc(labels?: Labels, amount = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
    if (!this.labelMap.has(key)) this.labelMap.set(key, labels);
  }

  dec(labels?: Labels, amount = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - amount);
    if (!this.labelMap.has(key)) this.labelMap.set(key, labels);
  }

  value(labels?: Labels): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, val] of this.values) {
        const labels = this.labelMap.get(key);
        lines.push(`${this.name}${renderLabels(labels)} ${val}`);
      }
    }
    return lines.join("\n");
  }
}

// ── Histogram ─────────────────────────────────────────────────────────────

export const DEFAULT_BUCKETS: readonly number[] = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

interface HistogramData {
  // bucket upper bound -> count of observations <= that bound (non-cumulative)
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

export class Histogram {
  readonly name: string;
  readonly help: string;
  private readonly bucketBounds: readonly number[];
  private readonly data = new Map<string, HistogramData>();
  private readonly labelMap = new Map<string, Labels | undefined>();

  constructor(
    name: string,
    help: string,
    buckets: readonly number[] = DEFAULT_BUCKETS,
  ) {
    this.name = name;
    this.help = help;
    this.bucketBounds = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels?: Labels): void {
    const key = labelKey(labels);
    if (!this.data.has(key)) {
      const buckets = new Map<number, number>();
      for (const b of this.bucketBounds) buckets.set(b, 0);
      this.data.set(key, { buckets, sum: 0, count: 0 });
      this.labelMap.set(key, labels);
    }
    const d = this.data.get(key)!;
    for (const b of this.bucketBounds) {
      if (value <= b) d.buckets.set(b, (d.buckets.get(b) ?? 0) + 1);
    }
    d.sum += value;
    d.count++;
  }

  value(labels?: Labels): { sum: number; count: number } {
    const d = this.data.get(labelKey(labels));
    return { sum: d?.sum ?? 0, count: d?.count ?? 0 };
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    if (this.data.size === 0) {
      for (const b of this.bucketBounds) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join("\n");
    }

    for (const [key, d] of this.data) {
      const labels = this.labelMap.get(key);
      const base = renderLabels(labels);

      // Buckets are already cumulative — observe() increments every
      // upper bound that the value fits into, so emit counts directly.
      for (const b of this.bucketBounds) {
        const lePart = insertLeLabel(base, String(b));
        lines.push(`${this.name}_bucket${lePart} ${d.buckets.get(b) ?? 0}`);
      }
      const infPart = insertLeLabel(base, "+Inf");
      lines.push(`${this.name}_bucket${infPart} ${d.count}`);
      lines.push(`${this.name}_sum${base} ${d.sum}`);
      lines.push(`${this.name}_count${base} ${d.count}`);
    }

    return lines.join("\n");
  }
}

/** Merge le label into an existing label string like `{method="GET"}`. */
function insertLeLabel(base: string, le: string): string {
  if (!base) return `{le="${le}"}`;
  // base is `{k="v",...}` — strip trailing `}` and append.
  return base.slice(0, -1) + `,le="${le}"}`;
}

// ── Registry ─────────────────────────────────────────────────────────────

type Metric = Counter | Gauge | Histogram;

export class Registry {
  private readonly metrics: Metric[] = [];

  register<T extends Metric>(metric: T): T {
    this.metrics.push(metric);
    return metric;
  }

  /** Render all registered metrics in Prometheus text format (0.0.4). */
  render(): string {
    return this.metrics.map((m) => m.render()).join("\n") + "\n";
  }

  /** For testing — clears all registered metrics. */
  clear(): void {
    this.metrics.length = 0;
  }
}

// ── Default registry ──────────────────────────────────────────────────────

export const defaultRegistry = new Registry();

/** Convenience: create and register a Counter in the default registry. */
export function counter(name: string, help: string): Counter {
  return defaultRegistry.register(new Counter(name, help));
}

/** Convenience: create and register a Gauge in the default registry. */
export function gauge(name: string, help: string): Gauge {
  return defaultRegistry.register(new Gauge(name, help));
}

/** Convenience: create and register a Histogram in the default registry. */
export function histogram(
  name: string,
  help: string,
  buckets?: readonly number[],
): Histogram {
  return defaultRegistry.register(new Histogram(name, help, buckets));
}
