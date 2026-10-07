import { expect, test } from "@playwright/test";
// Visual regression of the instruments with the canvas swapped for the poster (WebGL output is not bit-stable across GPUs).
for (const view of ["atlas", "transit", "spectrum", "habitability", "timeline"]) {
  test(`visual: ${view}`, async ({ page }) => {
    await page.goto(`/?gfx=off&skip=1&view=${view}&system=s1&planet=p2&year=2012`); await page.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
    await expect(page.getByTestId("hud")).toBeVisible(); await page.waitForTimeout(400); await expect(page).toHaveScreenshot(`${view}.png`);
  });
}
