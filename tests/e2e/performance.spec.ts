import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
// Budgets. Frame times under SwiftShader (CPU rasteriser) are bounds, not GPU results.
const out = new URL("../../apps/web/out/", import.meta.url).pathname;
const size = (dir: string): number => readdirSync(dir).reduce((a, f) => { const p = join(dir, f), s = statSync(p); return a + (s.isDirectory() ? size(p) : f.endsWith(".js") ? gzipSync(readFileSync(p)).length : 0); }, 0);
test("download weight stays inside the budget", () => { expect(statSync(out + "models/planets.glb").size).toBeLessThan(1_000_000); expect(statSync(out + "data/catalog.json").size).toBeLessThan(60_000); expect(size(out + "_next/static/chunks")).toBeLessThan(750_000); });
test("scene cost: draw calls and triangles are bounded", async ({ page }) => {
  await page.goto("/?skip=1&view=transit&system=s1&planet=p2"); await page.waitForFunction(() => typeof (window as unknown as { __nebulaStats?: unknown }).__nebulaStats === "function", null, { timeout: 30_000 }); await page.waitForTimeout(2500);
  const st = await page.evaluate(() => (window as unknown as { __nebulaStats: () => { calls: number; triangles: number } }).__nebulaStats()); console.log("renderer", JSON.stringify(st)); expect(st.calls).toBeLessThan(150); expect(st.triangles).toBeLessThan(200_000);
});
test("a lab slider updates the curve while the canvas renders", async ({ page }) => {
  await page.goto("/?skip=1&view=transit&system=s1&planet=p2"); await expect(page.getByTestId("hud")).toBeVisible({ timeout: 30_000 }); await page.waitForTimeout(2000);
  const t0 = Date.now(); await page.getByTestId("lab-radiusEarth").fill("9"); await expect(page.getByText("9 R⊕")).toBeVisible(); console.log("slider-to-readout ms", Date.now() - t0); expect(Date.now() - t0).toBeLessThan(3000);
});
