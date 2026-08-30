/**
 * T3 - Nested describe blocks (3 levels deep)
 * T4 - Child process with stdout pipe
 * T5 - Timers in beforeEach/afterEach
 * T6 - File descriptor handle leaks
 * T7 - Net server handle lifecycle
 */

import assert from "node:assert";
import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { describeWithLeakDetector } from "..";

// ─────────────────────────────────────────────────────────
// T3. Nested describe blocks (3 levels deep)
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T3 - Nested describes", () => {
    let outerTimer: NodeJS.Timeout | undefined;

    before(() => {
        outerTimer = setTimeout(() => {}, 60000);
    });

    after(() => {
        clearTimeout(outerTimer);
    });

    describe("T3.1 - Level 2", () => {
        let middleTimer: NodeJS.Timeout | undefined;

        before(() => {
            middleTimer = setTimeout(() => {}, 60000);
        });

        after(() => {
            clearTimeout(middleTimer);
        });

        describe("T3.1.1 - Level 3", () => {
            it("deeply nested sync test", () => {
                assert.ok(outerTimer);
                assert.ok(middleTimer);
            });

            it("deeply nested async test", async () => {
                await new Promise((resolve) => setTimeout(resolve, 5));
                assert.ok(true);
            });

            it("deeply nested done callback test", (done) => {
                setTimeout(() => done(), 5);
            });
        });
    });

    describe("T3.2 - Sibling at level 2", () => {
        it("sibling test", () => {
            assert.ok(outerTimer);
        });
    });
});

// ─────────────────────────────────────────────────────────
// T4. Child process with stdout pipe
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T4 - Child process with stdout pipe", () => {
    it("T4.1 - execSync should not leak handles", () => {
        const result = execSync("node -e \"console.log('hello')\"", {
            encoding: "utf8"
        });
        assert.strictEqual(result.trim(), "hello");
    });

    it("T4.2 - multiple execSync calls", () => {
        for (let i = 0; i < 3; i++) {
            const result = execSync(`node -e "console.log(${i})"`, {
                encoding: "utf8"
            });
            assert.strictEqual(result.trim(), String(i));
        }
    });

    it("T4.3 - execSync with stderr", () => {
        const result = execSync("node -e \"process.stderr.write('err'); console.log('out')\"", { encoding: "utf8" });
        assert.strictEqual(result.trim(), "out");
    });
});

// ─────────────────────────────────────────────────────────
// T5. Timer in beforeEach/afterEach
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T5 - Timers in beforeEach/afterEach", () => {
    let eachTimer: NodeJS.Timeout | undefined;

    beforeEach(() => {
        eachTimer = setTimeout(() => {}, 60000);
    });

    afterEach(() => {
        clearTimeout(eachTimer);
    });

    it("T5.1 - first test with per-test timer", () => {
        assert.ok(eachTimer);
    });

    it("T5.2 - second test with per-test timer", () => {
        assert.ok(eachTimer);
    });

    it("T5.3 - async test with per-test timer", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(eachTimer);
    });
});

// ─────────────────────────────────────────────────────────
// T6. File descriptor handle leaks
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T6 - File descriptor handle leaks", () => {
    it("T6.1 - leaked fd does not hang", () => {
        const tmpFile = path.join(os.tmpdir(), `leak_test_${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "test data");
        const fd = fs.openSync(tmpFile, "r");
        assert.ok(fd > 0);
        try {
            fs.unlinkSync(tmpFile);
        } catch (_e) {
            /* may fail on Windows */
        }
    });

    it("T6.2 - multiple leaked fds", () => {
        const tmpFile = path.join(os.tmpdir(), `leak_test2_${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "test data");
        const fds = [];
        for (let i = 0; i < 5; i++) {
            fds.push(fs.openSync(tmpFile, "r"));
        }
        assert.strictEqual(fds.length, 5);
        try {
            fs.unlinkSync(tmpFile);
        } catch (_e) {
            /* may fail on Windows */
        }
    });

    it("T6.3 - readable stream opened and destroyed", (done) => {
        const tmpFile = path.join(os.tmpdir(), `leak_test3_${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "some content for stream test");
        const stream = fs.createReadStream(tmpFile);
        stream.on("open", () => {
            stream.destroy();
        });
        stream.on("close", () => {
            try {
                fs.unlinkSync(tmpFile);
            } catch (_e) {
                /* ignore */
            }
            done();
        });
    });
});

// ─────────────────────────────────────────────────────────
// T7. Net server handle (ref'd, must be closed)
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T7 - Net server handle lifecycle", () => {
    let server: net.Server;

    before((done) => {
        server = net.createServer();
        // check-test-ports: dynamic-ok - needs an active handle for the detector to notice; the port is irrelevant
        server.listen(0, () => done());
    });

    after((done) => {
        server.close(() => done());
    });

    it("T7.1 - server is listening", () => {
        assert.ok(server.listening);
    });

    it("T7.2 - server address is available", () => {
        const addr = server.address();
        assert.ok(addr && typeof addr === "object", "expecting an AddressInfo from a listening tcp server");
        assert.ok(addr.port > 0);
    });
});
