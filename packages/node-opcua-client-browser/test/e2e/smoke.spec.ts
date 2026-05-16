/**
 * Smoke spec — verifies the Playwright harness, the esbuild test-page build,
 * and the browser bundle all wire up end-to-end. Later PRs replace this file
 * with specs that drive a real OPC UA session over `opc.ws://` / `opc.wss://`.
 */

import { expect, test } from "@playwright/test";

import { type HarnessContext, startHarness } from "./harness";

let harness: HarnessContext;

test.beforeAll(async () => {
    harness = await startHarness();
});

test.afterAll(async () => {
    await harness?.stopAll();
});

test("test page loads and node-opcua-client-browser module evaluates", async ({ page }) => {
    await page.goto(harness.pageUrl);

    // `#status` is set by test/page/main.ts once the module finishes evaluating.
    await expect(page.locator("#status")).toHaveText("ready");

    const ready = await page.evaluate(() => (window as unknown as { __opcuaReady?: unknown }).__opcuaReady);
    expect(ready).toMatchObject({ loaded: true });
    expect(Array.isArray((ready as { exports: unknown }).exports)).toBe(true);
});
