import "should";
import chalk from "chalk";
import {
    AttributeIds,
    ClientMonitoredItem,
    ClientSubscription,
    type ClientTCP_transport,
    DataType,
    type DataValue,
    OPCUAClient,
    type OPCUAServer,
    TimestampsToReturn,
    type TransferResult,
    Variant
} from "node-opcua";
import type { OPCUAClientImpl } from "node-opcua-client/source/private/opcua_client_impl";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device.js";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// -------------------------------------------------------------------------------------------------
// When the client reconnects and can no longer reactivate its previous session, it creates a NEW
// session and asks the server to TransferSubscriptions. Depending on whether the server authorises the
// transfer (OPC UA Part 4 §5.14.7), one of two things happens - both observable client-side through
// the subscriptionId:
//
//   * transfer ACCEPTED  -> the subscription keeps its original server-assigned subscriptionId;
//   * transfer REFUSED   -> the client rebuilds the subscription via CreateSubscription, which yields
//                           a NEW subscriptionId.
//
// This test exercises both outcomes against an anonymous client over an unsecured (#None) channel and
// verifies, end to end:
//   * the server returned the expected transfer StatusCode (Bad_UserAccessDenied vs Good);
//   * the client really went through its reconnection pipeline;
//   * the subscriptionId changed (rebuilt) or was preserved (transferred) accordingly;
//   * the monitored item keeps delivering FRESH values (the counter keeps advancing) afterwards.
// -------------------------------------------------------------------------------------------------

const counterNodeId = "ns=1;s=ReconnectionCounter";

interface ServerHandle {
    server: OPCUAServer;
    endpointUrl: string;
    transferStatuses: string[];
    stop: () => Promise<void>;
}

async function startServer(port: number, allowAnonymousSubscriptionTransferOnUnsecuredChannel: boolean): Promise<ServerHandle> {
    const server = await build_server_with_temperature_device({
        port,
        allowAnonymous: true,
        allowAnonymousSubscriptionTransferOnUnsecuredChannel
    });
    const endpointUrl = server.getEndpointUrl();

    // add a variable that keeps changing so that the monitored item receives a steady value stream
    const addressSpace = server.engine.addressSpace!;
    const namespace = addressSpace.getOwnNamespace();
    let counter = 0;
    const counterVariable = namespace.addVariable({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "ReconnectionCounter",
        nodeId: counterNodeId,
        dataType: "Int32",
        minimumSamplingInterval: 50,
        value: { get: () => new Variant({ dataType: DataType.Int32, value: counter }) }
    });
    const intervalId = setInterval(() => {
        counter += 1;
        counterVariable.setValueFromSource(new Variant({ dataType: DataType.Int32, value: counter }));
    }, 100);

    // capture the StatusCode returned for every TransferSubscriptions operation so the test can assert
    // that the §5.14.7 authorisation actually behaved as expected.
    const transferStatuses: string[] = [];
    const engine = server.engine as unknown as {
        transferSubscription: (...args: unknown[]) => Promise<TransferResult>;
    };
    const originalTransfer = engine.transferSubscription.bind(engine);
    engine.transferSubscription = async (...args: unknown[]): Promise<TransferResult> => {
        const result = await originalTransfer(...args);
        transferStatuses.push(result.statusCode.toString());
        return result;
    };

    return {
        server,
        endpointUrl,
        transferStatuses,
        stop: async () => {
            clearInterval(intervalId);
            await server.shutdown();
        }
    };
}

function breakClientSocket(client: OPCUAClient): void {
    // Brutally destroy the underlying socket to emulate an abrupt network failure so that the client
    // enters its reconnection pipeline.
    // double cast: OPCUAClient comes from the dist typings while OPCUAClientImpl
    // is deep-imported from source; #private fields keep the two nominally distinct
    const secureChannel = (client as unknown as OPCUAClientImpl)._secureChannel;
    const transport = secureChannel?.getTransport() as ClientTCP_transport | undefined;
    const clientSocket = transport?._socket;
    clientSocket?.end();
    clientSocket?.destroy();
    clientSocket?.emit("error", new Error("ECONNRESET"));
}

function collectValueChanges(
    monitoredItem: ClientMonitoredItem,
    count: number,
    timeout: number,
    message: string
): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
        const values: number[] = [];
        const timer = setTimeout(() => {
            monitoredItem.removeListener("changed", onChanged);
            reject(new Error(`${message} (received ${values.length}/${count} value changes within ${timeout} ms)`));
        }, timeout);
        const onChanged = (dataValue: DataValue) => {
            values.push(dataValue.value.value as number);
            doDebug && debugLog(chalk.cyan("   value changed"), values.length, dataValue.value?.toString());
            if (values.length >= count) {
                clearTimeout(timer);
                monitoredItem.removeListener("changed", onChanged);
                resolve(values);
            }
        };
        monitoredItem.on("changed", onChanged);
    });
}

interface ScenarioResult {
    before: number;
    after: number;
    reconnected: boolean;
    lastValueBeforeBreak: number;
    valuesAfterRecovery: number[];
}

/**
 * Establish an anonymous session + subscription + monitored item over an unsecured channel, then force
 * the "new session + TransferSubscriptions" reconnection path and wait for notifications to resume.
 */
async function runReconnectionScenario(handle: ServerHandle): Promise<ScenarioResult> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60_000,
        connectionStrategy: { maxRetry: -1, initialDelay: 100, maxDelay: 200 }
    });

    let reconnected = false;
    client.on("after_reconnection", () => {
        reconnected = true;
    });

    await client.connect(handle.endpointUrl);
    try {
        // anonymous session over the default SecurityPolicy #None endpoint
        const session = await client.createSession();

        const subscription = await ClientSubscription.create(session, {
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1_000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        });

        const monitoredItem = await ClientMonitoredItem.create(
            subscription,
            { nodeId: counterNodeId, attributeId: AttributeIds.Value },
            { samplingInterval: 100, queueSize: 10, discardOldest: true },
            TimestampsToReturn.Both
        );

        // 1) make sure the subscription is live and delivering notifications
        const valuesBefore = await collectValueChanges(
            monitoredItem,
            3,
            10_000,
            "subscription failed to deliver initial notifications"
        );
        const before = subscription.subscriptionId;
        const lastValueBeforeBreak = valuesBefore[valuesBefore.length - 1];

        // 2) force the client onto the "create a new session then TransferSubscriptions" reconnection
        //    path: break the channel and drop the owning session on the server while keeping the
        //    subscription alive (orphaned). The retained identity snapshot is anonymous over #None.
        breakClientSocket(client);
        for (const serverSession of handle.server.engine.getSessions()) {
            handle.server.engine.closeSession(serverSession.authenticationToken, /*deleteSubscriptions=*/ false, "Timeout");
        }

        // 3) after reconnection the monitored item must keep receiving FRESH value changes
        const valuesAfterRecovery = await collectValueChanges(
            monitoredItem,
            4,
            25_000,
            "subscription did not recover after reconnection"
        );
        const after = subscription.subscriptionId;

        return { before, after, reconnected, lastValueBeforeBreak, valuesAfterRecovery };
    } finally {
        await client.disconnect();
    }
}

function assertCommonRecoveryGuarantees(result: ScenarioResult): void {
    result.reconnected.should.eql(true, "client should have gone through its reconnection pipeline");
    result.before.should.be.greaterThan(0);
    result.after.should.be.greaterThan(0);

    // the counter must keep advancing after recovery: the stream is genuinely live, not a replay of
    // the last value seen before the break.
    const maxAfter = Math.max(...result.valuesAfterRecovery);
    const minAfter = Math.min(...result.valuesAfterRecovery);
    maxAfter.should.be.greaterThan(
        result.lastValueBeforeBreak,
        "the counter should keep increasing after recovery (fresh notifications)"
    );
    maxAfter.should.be.greaterThan(minAfter, "several distinct fresh values should be received after recovery");
}

describe("GHTR1 - transferred-vs-rebuilt subscription after reconnection (OPC UA Part 4 §5.14.7)", function (this: Mocha.Context) {
    this.timeout(60_000);

    it("GHTR1-A should REBUILD the subscription (new subscriptionId) when the server refuses the transfer", async () => {
        // strict enforcement (default): anonymous transfer over #None is refused with Bad_UserAccessDenied
        const handle = await startServer(20556, /*allowAnonymousSubscriptionTransferOnUnsecuredChannel=*/ false);
        try {
            const result = await runReconnectionScenario(handle);
            debugLog("subscriptionId before =", result.before, " after =", result.after);

            assertCommonRecoveryGuarantees(result);

            handle.transferStatuses.length.should.be.greaterThan(0, "the client should have attempted a transfer");
            handle.transferStatuses
                .some((s) => /BadUserAccessDenied/.test(s))
                .should.eql(true, `server should have refused the transfer, got: ${handle.transferStatuses.join(", ")}`);
            result.after.should.not.eql(result.before, "subscription should have been rebuilt with a new subscriptionId");
        } finally {
            await handle.stop();
        }
    });

    it("GHTR1-B should TRANSFER the subscription (same subscriptionId) when the server allows the transfer", async () => {
        // legacy opt-out: anonymous transfer over #None is accepted, so the subscriptionId is preserved
        const handle = await startServer(20557, /*allowAnonymousSubscriptionTransferOnUnsecuredChannel=*/ true);
        try {
            const result = await runReconnectionScenario(handle);
            debugLog("subscriptionId before =", result.before, " after =", result.after);

            assertCommonRecoveryGuarantees(result);

            handle.transferStatuses.length.should.be.greaterThan(0, "the client should have attempted a transfer");
            handle.transferStatuses
                .some((s) => /^Good/.test(s))
                .should.eql(true, `server should have accepted the transfer, got: ${handle.transferStatuses.join(", ")}`);
            result.after.should.eql(result.before, "subscription should have been transferred keeping its subscriptionId");
        } finally {
            await handle.stop();
        }
    });
});
