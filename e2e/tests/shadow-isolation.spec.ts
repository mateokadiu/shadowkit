import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const fixture = pathToFileURL(
  resolve(import.meta.dirname, "..", "fixtures", "shadow-isolation.html")
).toString();

test.describe("shadow isolation (real browser)", () => {
  test("inside-shadow .pill wins over the host page's body color", async ({
    page,
  }) => {
    await page.goto(fixture);

    const inside = await page.locator("sk-e2e-isolated >> span.pill").evaluate(
      (el) => getComputedStyle(el as HTMLElement).color
    );
    expect(inside).toBe("rgb(34, 197, 94)");

    const outside = await page.locator("#outside").evaluate(
      (el) => getComputedStyle(el as HTMLElement).color
    );
    // body { color: red } cascades into a regular descendant.
    expect(outside).toBe("rgb(255, 0, 0)");
  });

  test("the shadow root is open and queryable through Playwright", async ({
    page,
  }) => {
    await page.goto(fixture);
    const text = await page.locator("sk-e2e-isolated >> span.pill").textContent();
    expect(text).toBe("inside");
  });
});
