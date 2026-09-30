import { test, expect } from "@playwright/test";
async function signIn(page, name) {
  await page.goto("/");
  await page.getByLabel("Nickname", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Join the conversation" }).click();
  await expect(page.getByLabel("Search rooms")).toBeVisible();
  await expect(page.locator(".join-button").first()).toBeEnabled();
}
test("production stylesheet loads under CSP and guest entry works", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".entry-grid")).toHaveCSS("display", "grid");
  await expect(page.locator('link[rel="stylesheet"][media="print"]')).toHaveCount(0);
  await signIn(page, "Browser Alice");
  await page.getByLabel("Search rooms").fill("no matching room");
  await expect(page.getByRole("heading", { name: "No rooms found" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".room-card")).toHaveCount(6);
  expect(errors).toEqual([]);
});
test("two isolated users exchange messages, open activities and manage profile", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const alice = await a.newPage(),
      bob = await b.newPage();
    const errors = [];
    for (const page of [alice, bob])
      page.on("pageerror", (error) => errors.push(error.message));
    await signIn(alice, "Chat Alice");
    await signIn(bob, "Chat Bob");
    await alice.locator(".join-button").first().click();
    await bob.locator(".join-button").first().click();
    await alice.getByLabel("Message", { exact: true }).fill("Hello across components");
    await alice.getByRole("button", { name: "Send", exact: true }).click();
    await expect(bob.locator(".message-text")).toContainText(["Hello across components"]);
    await bob.getByLabel("Message", { exact: true }).fill("Hello back");
    await bob.getByRole("button", { name: "Send", exact: true }).click();
    await expect(alice.locator(".message-text")).toContainText([
      "Hello across components",
      "Hello back",
    ]);
    await alice.getByRole("button", { name: "Shared whiteboard" }).click();
    await expect(alice.getByLabel("Shared drawing canvas")).toBeVisible();
    await alice.getByRole("button", { name: "Close whiteboard" }).click();
    await alice.getByRole("button", { name: "Watch together", exact: true }).click();
    await expect(alice.getByLabel("Choose shared video")).toBeVisible();
    await alice.locator(".sidebar .self-profile").click();
    await alice.getByLabel("Display name").fill("Updated Alice");
    await alice.getByRole("button", { name: "Save profile" }).click();
    await expect(alice.locator(".sidebar")).toContainText("Updated Alice");
    await alice.locator(".sidebar .self-profile").click();
    await alice.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(alice.getByLabel("Nickname", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
