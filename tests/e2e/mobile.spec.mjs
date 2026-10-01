import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`chat stays usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByLabel("Nickname", { exact: true }).fill("Mobile Explorer");
    await page.getByRole("button", { name: "Join the conversation" }).click();
    await expect(page.getByLabel("Search rooms")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if (viewport.width <= 760) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await expect(page.locator(".sidebar")).toBeVisible();
      await page.locator(".navigation-close").click();
      await expect(page.locator(".sidebar")).toBeHidden();
    }
    await page.locator(".join-button").first().click();
    const message = page.getByLabel("Message", { exact: true });
    await expect(message).toBeVisible();
    await message.fill("Hello from a phone");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.locator(".message-text").filter({ hasText: "Hello from a phone" }).last(),
    ).toBeVisible();
    const composer = await page.locator(".composer").boundingBox();
    expect(composer.x).toBeGreaterThanOrEqual(0);
    expect(composer.x + composer.width).toBeLessThanOrEqual(viewport.width);
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
