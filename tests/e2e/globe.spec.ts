import { expect, test } from "@playwright/test";

test("initial load exposes dataset status and search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dataset-status")).toContainText("Loaded");
  await expect(page.getByLabel("Search airports")).toBeVisible();
});

test("search selects an airport and updates the URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("loading-overlay")).toBeHidden();

  await page.getByLabel("Search airports").fill("JFK");
  await page
    .getByRole("button", { name: /john f kennedy international airport/i })
    .click();

  await expect(page).toHaveURL(/airport=/);
  await expect(page.getByTestId("side-panel")).toContainText(
    "John F Kennedy International Airport"
  );
});

test("test api can select a route", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("loading-overlay")).toBeHidden();

  await page.evaluate(() => {
    window.__GLOBAL_PLANNER_TEST_API__?.selectRoute("3797__507");
  });

  await expect(page.getByTestId("side-panel")).toContainText("Route detail");
  await expect(page.getByTestId("side-panel")).toContainText("Heathrow Airport");
});
