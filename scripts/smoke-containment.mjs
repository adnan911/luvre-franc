import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const port = 3197;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: "ignore", windowsHide: true,
});
let exited = false;
child.on("exit", () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (exited) throw new Error("Local production server exited before smoke check");
    await delay(500);
    const response = await fetch(`http://127.0.0.1:${port}/orders/containment-unknown/paid`).catch(() => null);
    if (response?.ok) {
      const html = await response.text();
      assert(html.includes("Order not found.") || html.includes("Payment status temporarily unavailable."));
      assert(!html.includes("Confirmed Onchain"));
      ready = true; break;
    }
  }
  assert(ready, "Local production server did not become ready");
  const response = await fetch(`http://127.0.0.1:${port}/api/druto/simulate-webhook`, { method: "POST" });
  assert.equal(response.status, 410);
  console.log("PASS: missing/unavailable order is not shown as paid; simulator returns 410.");
} finally { child.kill(); }
