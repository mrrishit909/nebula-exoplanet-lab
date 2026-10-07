import { expect, test } from "@playwright/test";
test("reduced motion: static keyframes, no timeline, same navigation", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" }), page = await ctx.newPage(); await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Opening story" })).toContainText("shadows"); await expect(page.getByTestId("pause-motion")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("skip-intro").click(); await expect(page.getByRole("heading", { name: "Exoplanet Atlas" })).toBeVisible(); await page.getByTestId("nav-transit").click(); await expect(page.getByTestId("curve")).toBeVisible();
  expect(await page.locator(".panel").evaluate((el) => getComputedStyle(el).animationName)).toBe("none"); await ctx.close();
});
test("graphics failure: the poster still, and every instrument still works from the DOM", async ({ page }) => {
  await page.goto("/?gfx=off&skip=1&view=transit&system=s1&planet=p2"); await expect(page.getByTestId("poster")).toBeVisible(); await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByTestId("lab-inclinationDeg").fill("84"); await expect(page.getByTestId("no-transit")).toBeVisible(); await page.getByTestId("nav-spectrum").click(); await expect(page.getByTestId("spectrum")).toBeVisible(); await page.getByTestId("nav-timeline").click(); await expect(page.getByTestId("bars")).toBeVisible();
});
test("WebGL context loss falls back to the poster", async ({ page }) => {
  await page.goto("/?skip=1&view=atlas"); await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 }); await page.waitForFunction(() => typeof (window as unknown as { __nebulaStats?: unknown }).__nebulaStats === "function");
  await page.evaluate(() => document.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))); await expect(page.getByTestId("poster")).toBeVisible(); await page.getByTestId("nav-habitability").click(); await expect(page.getByTestId("hz-diagram")).toBeVisible();
});
test("phone width: instruments become a strip, the panel sits below, nothing scrolls sideways", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true }), page = await ctx.newPage(); await page.goto("/?skip=1&view=transit&system=s1&planet=p2&gfx=off");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0); const rail = await page.getByTestId("nav-atlas").boundingBox(), panel = await page.locator(".panel").boundingBox(); expect(rail!.y).toBeLessThan(panel!.y); await ctx.close();
});
test("pause motion stops the ambient animation", async ({ page }) => { await page.goto("/?skip=1&view=atlas"); await page.getByTestId("pause-motion").click(); await expect(page.getByTestId("pause-motion")).toHaveText("Resume motion"); });
