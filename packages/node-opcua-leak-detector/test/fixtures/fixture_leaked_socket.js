// Fixture: leaked net.Server socket handle
const assert = require("node:assert");
const net = require("node:net");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-leaked-socket", () => {
    it("creates a net.Server that is NOT closed", (done) => {
        const server = net.createServer();
        server.listen(0, () => {
            const addr = server.address();
            assert.ok(addr);
            // Intentionally NOT calling server.close()
            // The leak detector should still allow process exit
            done();
        });
    });
});
