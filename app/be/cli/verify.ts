#!/usr/bin/env bun
/**
 * CLI: nordlys verify <code>
 *
 * Called inside the container to verify ownership during onboarding.
 * Usage: docker exec nordlys verify ABC123
 */

const code = process.argv[2];

if (!code || code === "--help") {
  console.log("Usage: nordlys verify <CODE>");
  console.log("  Verifies your ownership of this node during setup.");
  process.exit(code ? 0 : 1);
}

const gatewayPort = process.env.PORT ?? "3000";
const url = `http://127.0.0.1:${gatewayPort}/v1/setup/verify`;

try {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: code.toUpperCase().trim() }),
  });

  const data = await resp.json() as Record<string, unknown>;

  if (resp.ok) {
    console.log("\n  ┌─────────────────────────────────────┐");
    console.log("  │  ✓  Node verified successfully!     │");
    console.log("  │     You can now use the dashboard.  │");
    console.log("  └─────────────────────────────────────┘\n");
    process.exit(0);
  } else {
    const error = data.error ?? "unknown_error";
    if (error === "code_expired") {
      console.error("\n  ✗  Verification code expired. Generate a new one in the browser.\n");
    } else if (error === "too_many_attempts") {
      console.error("\n  ✗  Too many failed attempts. Generate a new code in the browser.\n");
    } else if (error === "invalid_code") {
      console.error(`\n  ✗  Invalid code. ${data.attempts_remaining} attempts remaining.\n`);
    } else {
      console.error(`\n  ✗  Error: ${error}\n`);
    }
    process.exit(1);
  }
} catch (err) {
  console.error("\n  ✗  Could not reach the API gateway. Is the service running?\n");
  process.exit(1);
}
