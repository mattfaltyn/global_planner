import { expect, test } from "@playwright/test";

test("real globe renderer desktop smoke loads and plays without test harness controls", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await expect(page.getByTestId("loading-overlay")).toBeHidden();
  await expect(page.getByTestId("globe-canvas")).toBeVisible();
  await expect(page.getByLabel("Search airports")).toBeVisible();
  await expect(page.getByTestId("trip-playback-bar")).toContainText("Vancouver to Porto");
  await expect(page.locator('[data-testid="globe-canvas"] canvas')).toHaveCount(1);

  await expect(page.getByText("Simulate manual camera")).toHaveCount(0);
  await expect(page.locator('[data-testid="test-globe-summary"]')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__GLOBAL_PLANNER_TEST_API__))).toBe(false);

  await page.getByTestId("trip-playback-bar").getByRole("button", { name: "Play" }).click();
  await expect(
    page.getByTestId("trip-playback-bar").getByRole("button", { name: "Pause" })
  ).toBeVisible();
  await expect
    .poll(async () => {
      return page.getByTestId("trip-playback-bar").textContent();
    })
    .not.toContain("Trip progress: 0%");

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
