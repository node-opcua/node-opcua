import { AttributeIds, DataType, OPCUAClient, RepublishResponse, StatusCodes, TimestampsToReturn, Variant } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import "should";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device.js";
// 2027: free in this package's port map (2025 is taken by test_issue_1442.ts;
// 2024/2025 used, next free slot before 2030)
const port = 2027;
describe("issue #1524 - e2e - client must resume publishing after Republish returns BadMessageNotAvailable", function () {
    this.timeout(Math.max(60 * 1000, this.timeout()));
    let server;
    let client;
    let session;
    let subscription;
    let monitoredItem;
    let counterNode;
    let timerId;
    let republishRequestCount = 0;
    let changeCount = 0;
    async function start_server() {
        server = await build_server_with_temperature_device({ port });
        // Make the server answer every Republish with BadMessageNotAvailable carried as the
        // operation-level serviceResult of a regular RepublishResponse (the CoDeSys behaviour).
        server._on_RepublishRequest = (message, channel) => {
            republishRequestCount += 1;
            const response = new RepublishResponse({
                responseHeader: { serviceResult: StatusCodes.BadMessageNotAvailable }
            });
            return channel.send_response("MSG", response, message);
        };
        const namespace = server.engine.addressSpace?.getOwnNamespace();
        if (!namespace) {
            throw new Error("namespace not found");
        }
        let c = 0;
        counterNode = namespace.addVariable({
            browseName: "Counter",
            organizedBy: server.engine.addressSpace?.rootFolder.objects,
            dataType: "UInt32",
            value: new Variant({ dataType: DataType.UInt32, value: c })
        });
        timerId = setInterval(() => {
            c += 1;
            counterNode.setValueFromSource(new Variant({ dataType: "UInt32", value: c }), StatusCodes.Good);
        }, 100);
    }
    async function stop_server() {
        if (timerId) {
            clearInterval(timerId);
            timerId = undefined;
        }
        await server?.shutdown();
        server = undefined;
    }
    async function start_client_with_subscription() {
        const _client = OPCUAClient.create({
            // keep retrying so the client reconnects after the transient break
            connectionStrategy: { maxRetry: 1000, initialDelay: 10, maxDelay: 200, randomisationFactor: 0 },
            endpointMustExist: false,
            keepSessionAlive: true,
            // session and subscription must outlive the connection break
            requestedSessionTimeout: 60_000
        });
        client = _client;
        if (!server)
            throw new Error("server not started");
        await _client.connect(server.getEndpointUrl());
        session = await _client.createSession();
        subscription = await session.createSubscription2({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        });
        monitoredItem = await subscription.monitor({ nodeId: counterNode.nodeId, attributeId: AttributeIds.Value }, { samplingInterval: 50, discardOldest: true, queueSize: 10 }, TimestampsToReturn.Both);
        monitoredItem.on("changed", () => {
            changeCount += 1;
        });
    }
    async function stop_client() {
        try {
            await session?.close();
        }
        catch {
            /* ignore */
        }
        await client?.disconnect();
        client = undefined;
        session = undefined;
    }
    async function wait_for_n_changes(n, timeout) {
        const start = changeCount;
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                clearInterval(poll);
                reject(new Error(`timeout: only ${changeCount - start} change(s) received in ${timeout} ms (expected ${n})`));
            }, timeout);
            const poll = setInterval(() => {
                if (changeCount - start >= n) {
                    clearTimeout(timer);
                    clearInterval(poll);
                    resolve(changeCount - start);
                }
            }, 50);
        });
    }
    async function simulate_transient_connection_break(breakDuration) {
        // suspend the server endpoints so the client cannot reconnect during the break,
        // but the server keeps the session/subscription alive
        await server?.suspendEndPoints();
        const clientSocket = client._secureChannel.getTransport()._socket;
        clientSocket.end();
        clientSocket.destroy();
        clientSocket.emit("error", new Error("ECONNRESET"));
        await new Promise((resolve) => setTimeout(resolve, breakDuration));
        await server?.resumeEndPoints();
    }
    // Arm the connection_reestablished listener and return a promise that resolves when it fires.
    // The listener must be attached *before* the break is triggered, otherwise a fast reconnection
    // could emit connection_reestablished before we start listening and the test would hang.
    // The timeout makes a missed event / failed reconnection fail fast with a clear message instead
    // of stalling until the suite timeout.
    function arm_reconnection(timeout) {
        return new Promise((resolve, reject) => {
            const onReestablished = () => {
                clearTimeout(timer);
                resolve();
            };
            const timer = setTimeout(() => {
                client?.removeListener("connection_reestablished", onReestablished);
                reject(new Error(`timeout: connection_reestablished was not emitted within ${timeout} ms`));
            }, timeout);
            client?.once("connection_reestablished", onReestablished);
        });
    }
    beforeEach(async () => {
        republishRequestCount = 0;
        changeCount = 0;
        await start_server();
    });
    afterEach(async () => {
        if (monitoredItem) {
            monitoredItem.removeAllListeners();
            monitoredItem = undefined;
        }
        subscription = undefined;
        await stop_client();
        await stop_server();
    });
    it("should resume data-change notifications after a reconnection where the server replies BadMessageNotAvailable to Republish", async () => {
        await start_client_with_subscription();
        // 1) verify the subscription works before the break
        (await wait_for_n_changes(3, 5_000)).should.be.greaterThanOrEqual(3);
        // 2) transient connection break (server keeps the session alive).
        //    Arm the reconnection wait before triggering the break so we cannot miss the event.
        //    The 3 s break is suspended-endpoint time, so the timeout must comfortably exceed it.
        const reconnected = arm_reconnection(30_000);
        await simulate_transient_connection_break(3_000);
        await reconnected;
        // 3) the client must reactivate the session, call Republish (server -> BadMessageNotAvailable),
        //    then resume normal publishing. Without the fix the client either spins on Republish forever
        //    or stops sending PublishRequests, and the following wait times out.
        const received = await wait_for_n_changes(3, 15_000);
        received.should.be.greaterThanOrEqual(3, "data-change notifications must resume after reconnection");
        // sanity: the server really did exercise the Republish path with BadMessageNotAvailable
        republishRequestCount.should.be.greaterThanOrEqual(1, "the Republish path should have been exercised");
    });
});
//# sourceMappingURL=test_e2e_connection_reconnection_republish_BadMessageNotAvailable_1524.js.map