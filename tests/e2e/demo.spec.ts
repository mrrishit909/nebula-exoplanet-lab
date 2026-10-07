import { expect, test, type Page } from "@playwright/test";
const open = async (page: Page, url: string) => { await page.goto(url); await expect(page.getByTestId("hud")).toBeVisible({ timeout: 30_000 }); await expect(page.locator(".app")).toHaveAttribute("data-intro", "done"); await page.waitForFunction(() => typeof (window as unknown as { __nebulaStats?: unknown }).__nebulaStats === "function", null, { timeout: 30_000 }); };
const num = async (page: Page, id: string) => Number((await page.getByTestId(id).textContent())!.replace(/[^0-9.\-]/g, ""));
const range = (page: Page, id: string, v: number) => page.getByTestId(id).evaluate((el, x) => { (Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set as (v: string) => void).call(el, String(x)); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
type W = { __nLive: { starDim: number; journey: number } };

// Blueprint section 19, the demo script.
test("demo walk: intro, open a system, tilt the transit away, compare spectra, habitable zone, timeline", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("skip-intro")).toBeVisible(); await expect(page.getByTestId("intro")).toHaveAttribute("data-step", /[0-9]/);
  await page.getByTestId("skip-intro").click(); await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 40_000 }); // the navigation is revealed through the growing atmosphere mask; the intro layer is removed only after that has finished
  await expect(page.getByRole("heading", { name: "Exoplanet Atlas" })).toBeVisible(); await expect(page.getByTestId("where")).toContainText("NEB-017 · NEB-017 c");
  // open a system: a camera journey, not a page change
  await page.getByTestId("sys-s5").click(); await expect(page.getByTestId("where")).toContainText("NEB-208"); await page.waitForFunction(() => (window as unknown as W).__nLive.journey >= 1, null, { timeout: 15_000 }); await expect(page.getByTestId("planets").locator("button")).toHaveCount(3);
  // transit lab: tilt the orbit until the transit disappears
  await page.getByTestId("nav-transit").click(); await page.getByTestId("planet-select").selectOption("p13"); await page.getByTestId("lab-periodDays").fill("5"); await page.getByTestId("lab-radiusEarth").fill("11"); await page.getByTestId("lab-inclinationDeg").fill("89.9");
  await expect(page.getByTestId("curve")).toHaveAttribute("data-transits", "true"); const depth = await num(page, "depth"); expect(depth).toBeGreaterThan(5000);
  await page.getByTestId("lab-inclinationDeg").fill("84"); await expect(page.getByTestId("curve")).toHaveAttribute("data-transits", "false"); await expect(page.getByTestId("no-transit")).toContainText("No transit"); await expect(page.getByTestId("depth")).toHaveText("none");
  // compare synthetic spectra
  await page.getByTestId("nav-spectrum").click(); await page.getByTestId("specA").selectOption("p3"); await page.getByTestId("specB").selectOption("p1"); await expect(page.getByTestId("det-a-H2O")).toContainText("yes"); await expect(page.getByTestId("det-b-H2O")).toHaveText("no");
  await page.getByTestId("spec-noise").fill("1500"); await expect(page.getByTestId("det-a-K")).toHaveText("no");
  // habitable zone scenario
  await page.getByTestId("nav-habitability").click(); await page.getByTestId("to-hz").click(); await expect(page.getByTestId("inhz")).toHaveText("yes"); const esiIn = await num(page, "esi"); await page.getByTestId("out-hz").click(); await expect(page.getByTestId("inhz")).toHaveText("no"); expect(await num(page, "esi")).toBeLessThan(esiIn);
  // timeline
  await page.getByTestId("nav-timeline").click(); await page.getByTestId("year").fill("2005"); const f05 = await num(page, "found"); await page.getByTestId("year").fill("2016"); expect(await num(page, "found")).toBeGreaterThan(f05 * 2); await page.getByTestId("year").fill("2026"); expect(await num(page, "found")).toBe(260);
  expect(errors).toEqual([]);
});
test("the transit cursor, the observer view and the star's brightness agree", async ({ page }) => {
  await open(page, "/?skip=1&view=transit&system=s1&planet=p3"); await page.getByTestId("play").click();
  const set = async (ph: number) => { await range(page, "phase", Math.min(1, Math.max(0, ph))); await page.waitForTimeout(400); };
  // find the mid-transit phase by scanning the slider for the observer's "front" with the smallest separation
  let best = { ph: 0, z: 1e9 }; for (let ph = 0; ph < 1; ph += 0.05) { await range(page, "phase", ph); const z = Number(await page.getByTestId("observer").getAttribute("data-z")), f = (await page.getByTestId("observer").getAttribute("data-front")) === "true"; if (f && z < best.z) best = { ph, z }; }
  await set(best.ph); const dim = await page.evaluate(() => (window as unknown as W).__nLive.starDim); expect(dim).toBeLessThan(0.995); await expect(page.getByTestId("cursor")).toHaveAttribute("data-in", "true");
  await set((best.ph + 0.5) % 1); expect(await page.evaluate(() => (window as unknown as W).__nLive.starDim)).toBeCloseTo(1, 3); await expect(page.getByTestId("observer")).toHaveAttribute("data-front", "false");
});
test("catalog values: the lab starts from the planet and reset returns to them", async ({ page }) => {
  await open(page, "/?skip=1&view=transit&system=s1&planet=p2"); await expect(page.getByTestId("lab-radiusEarth")).toHaveValue("1.9"); await page.getByTestId("lab-radiusEarth").fill("8"); await expect(page.getByTestId("lab-radiusEarth")).toHaveValue("8"); await page.getByTestId("lab-reset").click(); await expect(page.getByTestId("lab-radiusEarth")).toHaveValue("1.9");
});
test("the habitability slider changes temperature monotonically and the compare table follows", async ({ page }) => {
  await open(page, "/?skip=1&view=habitability&system=s1&planet=p2"); const t = async (v: number) => { await page.getByTestId("a-slider").fill(String(v)); return num(page, "teq"); }; const a = await t(20), b = await t(50), c = await t(80); expect(a).toBeGreaterThan(b); expect(b).toBeGreaterThan(c);
  await page.getByTestId("add-compare").selectOption("p26"); await expect(page.getByTestId("compare").locator("tbody tr")).toHaveCount(4); await page.getByTestId("add-compare").selectOption("p25"); await expect(page.getByTestId("compare").locator("tbody tr")).toHaveCount(4);
});
test("deep link opens a system and a planet", async ({ page }) => { await open(page, "/?view=spectrum&system=s6&planet=p19"); await expect(page.getByTestId("where")).toContainText("NEB-233"); });
test("refresh mid-sequence restarts the intro cleanly", async ({ page }) => { await page.goto("/"); await page.waitForTimeout(1500); await page.reload(); await expect(page.getByTestId("intro")).toHaveAttribute("data-step", /[01]/); });
test("keyboard: instruments and sliders are reachable without a pointer", async ({ page }) => {
  await open(page, "/?skip=1&view=timeline");
  await expect(async () => { await page.getByTestId("year").focus(); await expect(page.getByTestId("year")).toBeFocused({ timeout: 500 }); }).toPass({ timeout: 15_000 });
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); expect(await num(page, "year-out")).toBe(2024);
});
test("choices made while the intro's last fade is still running are kept", async ({ page }) => {
  await page.goto("/"); await page.getByTestId("skip-intro").click(); await expect(page.getByTestId("where")).toBeVisible({ timeout: 30_000 });   // the navigation is live, the haze is still fading
  await page.getByTestId("sys-s5").click(); await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 40_000 }); await expect(page.getByTestId("where")).toContainText("NEB-208");
});
