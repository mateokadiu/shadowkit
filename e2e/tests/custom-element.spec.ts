import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const fixture = pathToFileURL(
  resolve(import.meta.dirname, "..", "fixtures", "custom-element.html")
).toString();

test.describe("customElements + Shadow DOM (real browser)", () => {
  test("attaches a real shadow root and renders inside it", async ({ page }) => {
    await page.goto(fixture);
    const host = page.locator("#under-test");
    await expect(host).toBeAttached();

    // Pierce the shadow boundary via Playwright's CSS shadow piercing.
    const button = host.locator("button#b");
    await expect(button).toHaveText("go");

    const color = await button.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(color).toBe("rgb(34, 197, 94)");
  });
});
