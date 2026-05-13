import { describe, expect, test, beforeEach } from "bun:test";
import { Counter, Gauge, Histogram, Registry, DEFAULT_BUCKETS } from "./index";

// Each test group uses a fresh local Registry so tests are isolated.

describe("Counter", () => {
  test("starts at zero", () => {
    const c = new Counter("test_total", "help");
    expect(c.value()).toBe(0);
  });

  test("inc increments by 1 by default", () => {
    const c = new Counter("test_total", "help");
    c.inc();
    c.inc();
    expect(c.value()).toBe(2);
  });

  test("inc with custom amount", () => {
    const c = new Counter("test_total", "help");
    c.inc(undefined, 5);
    expect(c.value()).toBe(5);
  });

  test("inc with labels tracks separate time series", () => {
    const c = new Counter("http_requests_total", "requests");
    c.inc({ method: "GET", status: "200" });
    c.inc({ method: "GET", status: "200" });
    c.inc({ method: "POST", status: "201" });
    expect(c.value({ method: "GET", status: "200" })).toBe(2);
    expect(c.value({ method: "POST", status: "201" })).toBe(1);
    expect(c.value({ method: "DELETE", status: "404" })).toBe(0);
  });

  test("render includes HELP and TYPE lines", () => {
    const c = new Counter("req_total", "total requests");
    const out = c.render();
    expect(out).toContain("# HELP req_total total requests");
    expect(out).toContain("# TYPE req_total counter");
  });

  test("render outputs correct label format", () => {
    const c = new Counter("req_total", "help");
    c.inc({ method: "GET", status: "200" });
    const out = c.render();
    expect(out).toContain('req_total{');
    expect(out).toContain('method="GET"');
    expect(out).toContain('status="200"');
    expect(out).toContain(" 1");
  });
});

describe("Gauge", () => {
  test("starts at zero", () => {
    const g = new Gauge("ws_sessions", "active sessions");
    expect(g.value()).toBe(0);
  });

  test("set replaces value", () => {
    const g = new Gauge("ws_sessions", "help");
    g.set(42);
    expect(g.value()).toBe(42);
    g.set(7);
    expect(g.value()).toBe(7);
  });

  test("inc and dec", () => {
    const g = new Gauge("ws_sessions", "help");
    g.inc();
    g.inc();
    g.dec();
    expect(g.value()).toBe(1);
  });

  test("gauge can go negative", () => {
    const g = new Gauge("delta", "help");
    g.dec(undefined, 3);
    expect(g.value()).toBe(-3);
  });

  test("render shows correct TYPE", () => {
    const g = new Gauge("ws_sessions", "help");
    g.set(5);
    const out = g.render();
    expect(out).toContain("# TYPE ws_sessions gauge");
    expect(out).toContain("ws_sessions");
  });
});

describe("Histogram", () => {
  test("starts with zero sum and count", () => {
    const h = new Histogram("req_duration_seconds", "help");
    const v = h.value();
    expect(v.sum).toBe(0);
    expect(v.count).toBe(0);
  });

  test("observe accumulates sum and count", () => {
    const h = new Histogram("req_duration_seconds", "help");
    h.observe(0.1);
    h.observe(0.5);
    const v = h.value();
    expect(v.count).toBe(2);
    expect(v.sum).toBeCloseTo(0.6);
  });

  test("observe with labels tracks separate series", () => {
    const h = new Histogram("req_duration_seconds", "help");
    h.observe(0.1, { method: "GET" });
    h.observe(1.0, { method: "POST" });
    expect(h.value({ method: "GET" }).count).toBe(1);
    expect(h.value({ method: "POST" }).count).toBe(1);
  });

  test("render includes _bucket, _sum, _count lines", () => {
    const h = new Histogram("req_duration_seconds", "help");
    h.observe(0.05);
    const out = h.render();
    expect(out).toContain("req_duration_seconds_bucket");
    expect(out).toContain("req_duration_seconds_sum");
    expect(out).toContain("req_duration_seconds_count");
    expect(out).toContain('le="+Inf"');
  });

  test("buckets are cumulative", () => {
    const h = new Histogram("latency", "help", [0.1, 0.5, 1.0]);
    h.observe(0.05);  // <= 0.1, <= 0.5, <= 1.0
    h.observe(0.3);   // NOT <= 0.1, <= 0.5, <= 1.0
    h.observe(0.8);   // NOT <= 0.1, NOT <= 0.5, <= 1.0
    const out = h.render();
    const lines = out.split("\n");
    const b01 = lines.find((l) => l.includes('le="0.1"'));
    const b05 = lines.find((l) => l.includes('le="0.5"'));
    const b10 = lines.find((l) => l.includes('le="1"'));
    const bInf = lines.find((l) => l.includes('le="+Inf"'));
    expect(b01).toContain(" 1");  // only 0.05 fits
    expect(b05).toContain(" 2");  // 0.05 + 0.3
    expect(b10).toContain(" 3");  // all three
    expect(bInf).toContain(" 3"); // +Inf = total count
  });
});

describe("Registry", () => {
  test("render joins multiple metrics with newline separator", () => {
    const reg = new Registry();
    const c = reg.register(new Counter("a_total", "counter a"));
    const g = reg.register(new Gauge("b_gauge", "gauge b"));
    c.inc();
    g.set(7);
    const out = reg.render();
    expect(out).toContain("# HELP a_total counter a");
    expect(out).toContain("# HELP b_gauge gauge b");
    // Ends with a trailing newline
    expect(out.endsWith("\n")).toBe(true);
  });

  test("clear removes all metrics", () => {
    const reg = new Registry();
    reg.register(new Counter("x_total", "help"));
    reg.clear();
    const out = reg.render();
    expect(out.trim()).toBe("");
  });

  test("register returns the metric for chained use", () => {
    const reg = new Registry();
    const c = reg.register(new Counter("y_total", "help"));
    c.inc();
    expect(c.value()).toBe(1);
  });

  test("empty registry render is just newline", () => {
    const reg = new Registry();
    expect(reg.render()).toBe("\n");
  });
});
