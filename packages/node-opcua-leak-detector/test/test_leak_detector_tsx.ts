/**
 * TypeScript test that proves the tsx-caused event loop hang
 * and demonstrates the leak detector fix.
 *
 * ROOT CAUSE: tsx (TypeScript loader), loaded via mocha --require tsx,
 * refs process.stdout and process.stderr WriteStream handles. After
 * tests complete, these ref'd handles keep the event loop alive
 * indefinitely. Mocha 12+ does not call process.exit(), so the
 * process hangs.
 *
 * This test file is TypeScript — mocha requires tsx to load it.
 * If the fix works, the process exits cleanly.
 * If the fix fails, the process hangs after "N passing".
 */

import assert from "node:assert";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { describeWithLeakDetector } = require("../src/resource_leak_detector");

// ─────────────────────────────────────────────────────────
// TS1. Basic TypeScript test — proves tsx is loaded
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("TS1 - TypeScript basic (tsx loaded)", () => {

    it("TS1.1 - TypeScript syntax works", () => {
        const x: number = 42;
        assert.strictEqual(x, 42);
    });

    it("TS1.2 - async/await in TypeScript", async () => {
        const result: string = await Promise.resolve("hello");
        assert.strictEqual(result, "hello");
    });

    it("TS1.3 - TypeScript generics", () => {
        function identity<T>(val: T): T { return val; }
        assert.strictEqual(identity(42), 42);
        assert.strictEqual(identity("foo"), "foo");
    });
});

// ─────────────────────────────────────────────────────────
// TS2. Timer lifecycle in TypeScript — same as JS but
//      proves the fix works with tsx ref'd stdio
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("TS2 - TypeScript timer lifecycle", () => {

    it("TS2.1 - cleaned timer", () => {
        const t = setTimeout(() => {}, 60000);
        clearTimeout(t);
    });

    it("TS2.2 - leaked timer caught by detector", () => {
        // Intentionally leaked — detector cleans it in stop()
        setTimeout(() => {}, 60000);
    });

    it("TS2.3 - unref'd timer", () => {
        const t = setTimeout(() => {}, 60000);
        t.unref();
    });
});

// ─────────────────────────────────────────────────────────
// TS3. Multiple blocks — proves sequential start/stop
//      with tsx doesn't hang
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("TS3 - TypeScript second block", () => {

    it("TS3.1 - process exits after multiple tsx blocks", () => {
        assert.ok(true);
    });

    it("TS3.2 - async in second block", async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});

describeWithLeakDetector("TS4 - TypeScript third block (final)", () => {

    it("TS4.1 - final block exits cleanly", () => {
        assert.strictEqual(1 + 1, 2);
    });
});
