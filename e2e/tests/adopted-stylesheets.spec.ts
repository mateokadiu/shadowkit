import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const fixture = pathToFileURL(
  resolve(import.meta.dirname, "..", "fixtures", "adopted-stylesheets.html")
).toString();

test.describe("adoptedStyleSheets behavior (real browser)", () => {
  test("two instances share one CSSStyleSheet object", async ({ page }) => {
    await page.goto(fixture);

    const same = await page.evaluate(() => {
      const a = (window as unknown as { __getAdopted: (id: string) => CSSStyleSheet[] })
        .__getAdopted("a");
      const b = (window as unknown as { __getAdopted: (id: string) => CSSStyleSheet[] })
        .__getAdopted("b");
      const shared = (window as unknown as { __sharedSheet: CSSStyleSheet }).__sharedSheet;
      return {
        aLen: a.length,
        bLen: b.length,
        aHasShared: a[0] === shared,
        bHasShared: b[0] === shared,
        sameRef: a[0] === b[0],
      };
    });

    expect(same.aLen).toBe(1);
    expect(same.bLen).toBe(1);
    expect(same.aHasShared).toBe(true);
    expect(same.bHasShared).toBe(true);
    expect(same.sameRef).toBe(true);
  });

  test("adopted CSS actually styles both instances", async ({ page }) => {
    await page.goto(fixture);

    const colorA = await page.locator("#a >> span.pill").evaluate(
      (el) => getComputedStyle(el as HTMLElement).backgroundColor
    );
    const colorB = await page.locator("#b >> span.pill").evaluate(
      (el) => getComputedStyle(el as HTMLElement).backgroundColor
    );
    expect(colorA).toBe("rgb(59, 130, 246)");
    expect(colorB).toBe("rgb(59, 130, 246)");
  });

  test("updating the shared sheet propagates to every adopter", async ({
    page,
  }) => {
    await page.goto(fixture);

    await page.evaluate(() => {
      const sheet = (window as unknown as { __sharedSheet: CSSStyleSheet })
        .__sharedSheet;
      sheet.replaceSync(
        ":host { display: block; } .pill { background: rgb(244, 63, 94); }"
      );
    });

    const colorA = await page.locator("#a >> span.pill").evaluate(
      (el) => getComputedStyle(el as HTMLElement).backgroundColor
    );
    expect(colorA).toBe("rgb(244, 63, 94)");
  });
});
