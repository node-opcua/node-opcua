// Fixture: leaked net.Server socket handle
import assert from "node:assert";
import net from "node:net";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-leaked-socket", () => {
    it("creates a net.Server that is NOT closed", (done) => {
        const server = net.createServer();
        // check-test-ports: dynamic-ok - the fixture needs an open handle to leak; the port is irrelevant
        server.listen(0, () => {
            const addr = server.address();
            assert.ok(addr);
            // Intentionally NOT calling server.close()
            // The leak detector should still allow process exit
            done();
        });
    });
});
