/**
 * An exception-based monitored item (samplingInterval 0 on a Variable whose MinimumSamplingInterval
 * is 0) must apply the node's read permission on every notification, exactly as the sampled path
 * does. The FrontThreadEngine already asserts this (see test_front_threads.ts, "does not hand a
 * session the values of a node its roles may not read"). This asserts the same invariant on the
 * plain engine, where only the first value was gated before: the first notification was refused and
 * every later change was delivered in full.
 */
import {
    AttributeIds,
    ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    MessageSecurityMode,
    OPCUAClient,
    SecurityPolicy,
    TimestampsToReturn
} from "node-opcua-client";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType } from "node-opcua-types";
import { DataType, type VariantLike } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../dist/index.js";

const port = 5862;
const port2 = 5863;
const OPERATOR = resolveNodeId("ns=0;i=15680"); // WellKnownRole_Operator
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate: () => boolean, what: string, timeout = 5000): Promise<void> {
    const end = Date.now() + timeout;
    while (!predicate()) {
        if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
        await pause(10);
    }
}

describe("exception-based monitored item applies the node read permission on every delivery", function (this: Mocha.Suite) {
    this.timeout(60000);
    let server: OPCUAServer;
    let secretNodeId: string;

    before(async () => {
        // minSupportedSampleRate 0: an exception-based item reports every change at once, no window
        server = new OPCUAServer({ port, allowAnonymous: true, serverCapabilities: { minSupportedSampleRate: 0 } });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const ns = addressSpace.getOwnNamespace();
        secretNodeId = `ns=${ns.index};s=Secret`;
        ns.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: secretNodeId,
            browseName: "Secret",
            dataType: "Double",
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            minimumSamplingInterval: 0,
            // the Operator role may read; the anonymous session of this test may not
            rolePermissions: [{ roleId: OPERATOR, permissions: PermissionType.Browse | PermissionType.Read }],
            value: { dataType: DataType.Double, value: 1 }
        });
        await server.start();
    });

    after(async () => {
        await server.shutdown();
    });

    function setFromSource(value: VariantLike): void {
        (
            server.engine.addressSpace!.findNode(secretNodeId) as unknown as { setValueFromSource(v: VariantLike): void }
        ).setValueFromSource(value);
    }

    async function collect(subscription: ClientSubscription, samplingInterval: number) {
        const values: DataValue[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: secretNodeId, attributeId: AttributeIds.Value },
            { samplingInterval, discardOldest: true, queueSize: 100 },
            TimestampsToReturn.Both
        );
        item.on("changed", (dataValue: DataValue) => values.push(dataValue));
        await new Promise<void>((resolve, reject) => {
            item.once("initialized", () => resolve());
            item.once("err", (message: string) => reject(new Error(message)));
        });
        return { item, values };
    }

    async function withAnonymousSession<T>(action: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });
        await client.connect(server.getEndpointUrl());
        try {
            const session = await client.createSession(); // anonymous
            try {
                return await action(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    const goodValuesOf = (values: DataValue[]) => values.filter((v) => v.statusCode.isGood()).map((v) => v.value.value);

    it("delivers no good value to a denied session: the exception path, with a sampled control", async () => {
        await withAnonymousSession(async (session) => {
            // the node is genuinely out of reach over the Read service
            const plain = await session.read({ nodeId: secretNodeId, attributeId: AttributeIds.Value });
            should(plain.statusCode).eql(StatusCodes.BadUserAccessDenied, "the plain Read must be denied for the lab to be valid");

            const subscription = await session.createSubscription2({
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 10
            });

            const exception = await collect(subscription, 0); // the exception-based path (the weakness)
            const sampled = await collect(subscription, 100); // the sampled control
            await until(() => exception.values.length >= 1 && sampled.values.length >= 1, "the initial notifications");

            // the server drives the value; a steady writer, as process data is
            for (let k = 2; k <= 6; k++) {
                setFromSource({ dataType: DataType.Double, value: k });
                await pause(60);
            }
            await pause(400);

            await exception.item.terminate();
            await sampled.item.terminate();
            await subscription.terminate();

            should(exception.values[0].statusCode).eql(
                StatusCodes.BadUserAccessDenied,
                "the first exception notification is denied"
            );
            should(goodValuesOf(exception.values)).eql([], "no good value reaches the denied session on the exception-based path");
            should(goodValuesOf(sampled.values)).eql([], "no good value reaches the denied session on the sampled path");
        });
    });
});

describe("exception-based monitored item honours unresolvedPermissionPolicy 'deny' on every delivery", function (this: Mocha.Suite) {
    // The node carries NO role permissions and the namespace default is unset, so
    // getRolePermissions(true) is null. The server fails closed, so enforcement still denies Read to
    // an unresolved (anonymous) session. The previous guard (getRolePermissions(true)) was therefore
    // falsy and the exception path streamed every change in full. The re-check must honour the deny
    // policy the same way the Read service does.
    this.timeout(60000);
    let server: OPCUAServer;
    let secretNodeId: string;

    before(async () => {
        server = new OPCUAServer({
            port: port2,
            allowAnonymous: true,
            unresolvedPermissionPolicy: "deny",
            serverCapabilities: { minSupportedSampleRate: 0 }
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const ns = addressSpace.getOwnNamespace();
        secretNodeId = `ns=${ns.index};s=Secret`;
        ns.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: secretNodeId,
            browseName: "Secret",
            dataType: "Double",
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            minimumSamplingInterval: 0,
            // no rolePermissions: the deny policy, not an explicit grant, is what withholds Read
            value: { dataType: DataType.Double, value: 1 }
        });
        await server.start();
    });

    after(async () => {
        await server.shutdown();
    });

    function setFromSource(value: VariantLike): void {
        (
            server.engine.addressSpace!.findNode(secretNodeId) as unknown as { setValueFromSource(v: VariantLike): void }
        ).setValueFromSource(value);
    }

    async function collect(subscription: ClientSubscription, samplingInterval: number) {
        const values: DataValue[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: secretNodeId, attributeId: AttributeIds.Value },
            { samplingInterval, discardOldest: true, queueSize: 100 },
            TimestampsToReturn.Both
        );
        item.on("changed", (dataValue: DataValue) => values.push(dataValue));
        await new Promise<void>((resolve, reject) => {
            item.once("initialized", () => resolve());
            item.once("err", (message: string) => reject(new Error(message)));
        });
        return { item, values };
    }

    async function withAnonymousSession<T>(action: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });
        await client.connect(server.getEndpointUrl());
        try {
            const session = await client.createSession(); // anonymous -> no resolvable permission
            try {
                return await action(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    const goodValuesOf = (values: DataValue[]) => values.filter((v) => v.statusCode.isGood()).map((v) => v.value.value);

    it("delivers no good value to a deny-policy session: the exception path, with a sampled control", async () => {
        await withAnonymousSession(async (session) => {
            const plain = await session.read({ nodeId: secretNodeId, attributeId: AttributeIds.Value });
            should(plain.statusCode).eql(
                StatusCodes.BadUserAccessDenied,
                "the plain Read must be denied by the deny policy for the lab to be valid"
            );

            const subscription = await session.createSubscription2({
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 10
            });

            const exception = await collect(subscription, 0); // the exception-based path (the weakness)
            const sampled = await collect(subscription, 100); // the sampled control
            await until(() => exception.values.length >= 1 && sampled.values.length >= 1, "the initial notifications");

            for (let k = 2; k <= 6; k++) {
                setFromSource({ dataType: DataType.Double, value: k });
                await pause(60);
            }
            await pause(400);

            await exception.item.terminate();
            await sampled.item.terminate();
            await subscription.terminate();

            should(exception.values[0].statusCode).eql(
                StatusCodes.BadUserAccessDenied,
                "the first exception notification is denied"
            );
            should(goodValuesOf(exception.values)).eql(
                [],
                "no good value reaches the deny-policy session on the exception-based path"
            );
            should(goodValuesOf(sampled.values)).eql([], "no good value reaches the deny-policy session on the sampled path");
        });
    });
});
