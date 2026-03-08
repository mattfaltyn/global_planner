import { expect, test } from "@playwright/test";

test("initial load exposes itinerary playback UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dataset-status")).toContainText("Loaded");
  await expect(page.getByLabel("Search airports")).toBeVisible();
  await expect(page.getByTestId("trip-playback-bar")).toContainText("Vancouver to Porto");
  await expect(page.getByTestId("itinerary-dock")).toContainText("Travel itinerary");
  await expect
    .poll(async () => {
      return page.evaluate(() => window.__GLOBAL_PLANNER_TEST_API__?.getCameraState()?.mode);
    })
    .toBe("overview");
});

test("search adds a stop and opens edit mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("loading-overlay")).toBeHidden();
  const initialStopCount = await page.evaluate(
    () => window.__GLOBAL_PLANNER_TEST_API__?.getState()?.stopCount ?? 0
  );

  await page.getByLabel("Search airports").fill("MAD");
  await page.getByRole("listbox").getByRole("button").first().click();

  await expect(page.getByTestId("itinerary-panel")).toContainText(`${initialStopCount + 1} total`);
  await expect(page.getByLabel("Search airports")).toHaveValue("");
});

test("whole-trip playback and test api wiring work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("loading-overlay")).toBeHidden();
  const itineraryState = await page.evaluate(() => window.__GLOBAL_PLANNER_TEST_API__?.getState());

  await page.getByTestId("trip-playback-bar").getByRole("button", { name: "Play" }).click();
  await expect(
    page.getByTestId("trip-playback-bar").getByRole("button", { name: "Pause" })
  ).toBeVisible();
  await expect
    .poll(async () => {
      return page.evaluate(() => window.__GLOBAL_PLANNER_TEST_API__?.getCameraState()?.mode);
    })
    .toBe("playback-follow");
  await expect
    .poll(async () => {
      return page.evaluate(() => window.__GLOBAL_PLANNER_TEST_API__?.getRenderState());
    })
    .toMatchObject({
      playbackStatus: "playing",
      activeLegIndex: 0,
    });
  const playbackRenderState = await page.evaluate(
    () => window.__GLOBAL_PLANNER_TEST_API__?.getRenderState()
  );
  expect(playbackRenderState?.visibleLabelCount).toBe(0);
  expect(playbackRenderState?.visiblePathCount).toBeLessThan(9);
  expect(playbackRenderState?.visibleStopCount).toBeLessThan(9);

  await page.getByTestId("globe-canvas").getByRole("button", { name: "Simulate manual camera" }).click();
  await expect(
    page.getByTestId("trip-playback-bar").getByRole("button", { name: "Recenter" })
  ).toBeVisible();
  await expect
    .poll(async () => {
      return page.evaluate(
        () => window.__GLOBAL_PLANNER_TEST_API__?.getCameraState()?.autoFollowSuspended
      );
    })
    .toBe(true);
  await page.getByTestId("trip-playback-bar").getByRole("button", { name: "Recenter" }).click();

  await page.evaluate(() => {
    window.__GLOBAL_PLANNER_TEST_API__?.selectLeg("seed-stop-4__seed-stop-5");
  });

  await expect(page).toHaveURL(/leg=seed-stop-4__seed-stop-5/);
  await expect(page.getByTestId("timeline-state")).toContainText(/timeline segments/);

  await page.getByTestId("globe-canvas").getByRole("button", { name: "Porto" }).click();
  await expect(page).toHaveURL(/stop=seed-stop-1/);
  await expect(page.getByTestId("test-globe-selection")).toContainText('"stopId":"seed-stop-1"');
  await expect
    .poll(async () => {
      return page.evaluate(() => window.__GLOBAL_PLANNER_TEST_API__?.getRenderState());
    })
    .toMatchObject({
      playbackStatus: "paused",
      visibleLabelCount: 0,
      visiblePathCount: itineraryState?.legCount ?? 0,
      visibleStopCount: itineraryState?.stopCount ?? 0,
    });
});
