import { test, expect } from "@playwright/test";

test("theme persists across reloads, sign-in and tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("switch", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(18, 20, 29)");
  await page.screenshot({ path: "test-results/theme-dark-entry.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("switch", { name: "Dark theme" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("circle.theme"))).toBe("dark");
  await page.getByLabel("Nickname", { exact: true }).fill("Theme Tester");
  await page.getByRole("button", { name: "Join the conversation" }).click();
  await expect(page.getByLabel("Search rooms")).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCSS("background-color", "rgb(27, 30, 43)");
  await page.screenshot({ path: "test-results/theme-dark-app.png", fullPage: true });
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("switch", { name: "Dark theme" })).toBeVisible();
  await page.getByRole("switch", { name: "Dark theme" }).click();
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

test("saved preference applies before Angular loads and overrides system preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("circle.theme", "light"));
  await page.route("**/main-*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
});

test("system fallback and toggle work when storage is blocked", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("switch", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
