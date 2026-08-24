/**
 * Smoke test page for the E2E harness scaffold.
 *
 * Imports the browser-client bundle and exposes a tiny
 * `window.__opcuaReady` marker once the module has loaded. Later PRs will
 * replace this with a real `window.connect(...)` entry point driving a full
 * OPC UA session.
 */

import * as browserModule from "../../source/index";

const status = document.querySelector("#status");

// Expose the loaded module for Playwright to introspect.
(window as any).__opcuaReady = {
    loaded: true,
    exports: Object.keys(browserModule).sort()
};

if (status) {
    status.textContent = "ready";
}
