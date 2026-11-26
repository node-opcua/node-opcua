import { fileURLToPath } from "node:url";
import { type ClientSession, OPCUAClient, UserTokenType } from "node-opcua-client";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

// the fronts of this engine listen on consecutive ports, from the one it is given
const port = 5893;

// the raw services of a session, without a client subscription object (it would publish itself)
type Callback<T> = (err: Error | null, response?: T) => void;
interface RawSession {
    createSubscription(request: object, callback: Callback<{ subscriptionId: number }>): void;
    createMonitoredItems(request: object, callback: Callback<{ results?: { statusCode: unknown }[] }>): void;
    publish(request: object, callback: Callback<PublishLike>): void;
    transferSubscriptions(request: object, callback: Callback<{ results?: { statusCode: unknown }[] }>): void;
}
interface PublishLike {
    notificationMessage?: { notificationData?: { monitoredItems?: { clientHandle: number; value: DataValue }[] }[] };
}

function call<T>(session: ClientSession, method: keyof RawSession, request: object): Promise<T> {
    const raw = session as unknown as Record<string, (request: object, callback: Callback<T>) => void>;
    return new Promise((resolve, reject) =>
        raw[method].call(session, request, (err, response) =>
            err || !response ? reject(err ?? new Error("no response")) : resolve(response)
        )
    );
}

/** the values of clientHandle 1 in the Publish responses of `session`, until some arrive or the time ends */
async function valuesPublishedTo(session: ClientSession, waitMs = 3000): Promise<DataValue[]> {
    const values: DataValue[] = [];
    const end = Date.now() + waitMs;
    while (values.length === 0 && Date.now() < end) {
        const response = await call<PublishLike>(session, "publish", { subscriptionAcknowledgements: [] });
        for (const data of response.notificationMessage?.notificationData ?? []) {
            for (const item of data.monitoredItems ?? []) {
                if (item.clientHandle === 1) values.push(item.value);
            }
        }
    }
    return values;
}

/**
 * A Subscription that TransferSubscriptions moves to another Session of the same user reads from then on
 * for that Session (OPC 10000-4 5.13.7): its items on a Variable that a permission rule restricts give the
 * new Session what a Read gives it, not what they read for the old one. The user has the Operator Role in
 * the session of a client named HIGH only (see the fixture).
 */
describe("FrontThreadEngine: the items of a transferred Subscription read for its new Session", function (this: Mocha.Suite) {
    this.timeout(120000);
    let engine: FrontThreadEngine;
    const clients: OPCUAClient[] = [];
    const appNodeset = fileURLToPath(new URL("./fixtures/front_mirrored_rules_nodeset.xml", import.meta.url));
    let nodeId: string;
    let node: { setValueFromSource(value: { dataType: DataType; value: number }): void };
    let nextValue = 700;

    before(async () => {
        engine = await FrontThreadEngine.create({
            nodesets: [nodesets.standard, appNodeset],
            serverCapabilities: { minSupportedSampleRate: 0 }
        });
        engine.registerNamespace("urn:test:front-transfer-item-context:own");
        const ns = engine.serverEngine.addressSpace?.getNamespaceIndex("urn:test:front-mirrored-rules");
        nodeId = `ns=${ns};i=1001`;
        const variable = engine.serverEngine.addressSpace?.findNode(nodeId) as unknown as typeof node & {
            setRolePermissions(rolePermissions: { roleId: unknown; permissions: number }[]): void;
        };
        node = variable;
        node.setValueFromSource({ dataType: DataType.UInt32, value: 100 });
        variable.setRolePermissions([
            { roleId: resolveNodeId("ns=0;i=15680"), permissions: PermissionFlag.Browse | PermissionFlag.Read }
        ]);
        await engine.start({
            fronts: 1,
            ownPorts: true,
            serverModule: new URL("./fixtures/front_transfer_roles_options.mjs", import.meta.url),
            serverModuleData: { port }
        });
    });

    after(async () => {
        for (const client of clients) await client.disconnect();
        await engine?.shutdown();
    });

    async function openSession(clientName: string): Promise<ClientSession> {
        const client = OPCUAClient.create({ clientName, endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        clients.push(client);
        await client.connect(`opc.tcp://localhost:${port}`);
        return client.createSession({ type: UserTokenType.UserName, userName: "operator", password: "operator-pw" });
    }

    /** HIGH creates a subscription and an item on the node and receives its first value; LOW takes it */
    async function transferToLow(sendInitialValues: boolean): Promise<{ high: ClientSession; low: ClientSession }> {
        const high = await openSession("HIGH");
        const low = await openSession("LOW");
        // control: the roles differ between the two sessions
        should((await high.read({ nodeId, attributeId: AttributeIds.Value })).statusCode).eql(StatusCodes.Good);
        should((await low.read({ nodeId, attributeId: AttributeIds.Value })).statusCode).eql(StatusCodes.BadUserAccessDenied);

        const { subscriptionId } = await call<{ subscriptionId: number }>(high, "createSubscription", {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 0
        });
        const items = await call<{ results?: { statusCode: unknown }[] }>(high, "createMonitoredItems", {
            subscriptionId,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
                    monitoringMode: 2,
                    requestedParameters: { clientHandle: 1, samplingInterval: 0, queueSize: 10, discardOldest: true }
                }
            ]
        });
        should(items.results?.[0].statusCode).eql(StatusCodes.Good);
        const first = await valuesPublishedTo(high);
        should(first.map((v) => v.statusCode)).eql([StatusCodes.Good]);

        const transfer = await call<{ results?: { statusCode: unknown }[] }>(low, "transferSubscriptions", {
            subscriptionIds: [subscriptionId],
            sendInitialValues
        });
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        return { high, low };
    }

    function shouldBeRefused(values: DataValue[]) {
        should(values.length).be.above(0);
        for (const value of values) {
            should(value.statusCode).eql(StatusCodes.BadUserAccessDenied);
            should(value.value.value).eql(null);
        }
    }

    it("FTC-1 sendInitialValues false: a later change reaches the new Session as a Read gives it", async () => {
        const { low } = await transferToLow(false);
        setTimeout(() => node.setValueFromSource({ dataType: DataType.UInt32, value: nextValue++ }), 200);
        shouldBeRefused(await valuesPublishedTo(low));
    });

    it("FTC-2 sendInitialValues true: the value sent again and a later change reach it as a Read gives it", async () => {
        const { low } = await transferToLow(true);
        shouldBeRefused(await valuesPublishedTo(low));
        setTimeout(() => node.setValueFromSource({ dataType: DataType.UInt32, value: nextValue++ }), 200);
        const later = await valuesPublishedTo(low, 1500);
        for (const value of later) should(value.statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("FTC-3 a transfer to a Session that may read the node gives it the value", async () => {
        // control in the other direction: LOW creates, HIGH takes the subscription and may read
        const low = await openSession("LOW");
        const high = await openSession("HIGH");
        const { subscriptionId } = await call<{ subscriptionId: number }>(low, "createSubscription", {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 0
        });
        await call(low, "createMonitoredItems", {
            subscriptionId,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
                    monitoringMode: 2,
                    requestedParameters: { clientHandle: 1, samplingInterval: 0, queueSize: 10, discardOldest: true }
                }
            ]
        });
        shouldBeRefused(await valuesPublishedTo(low));
        const transfer = await call<{ results?: { statusCode: unknown }[] }>(high, "transferSubscriptions", {
            subscriptionIds: [subscriptionId],
            sendInitialValues: false
        });
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        const value = nextValue++;
        setTimeout(() => node.setValueFromSource({ dataType: DataType.UInt32, value }), 200);
        const seen = await valuesPublishedTo(high);
        should(seen.map((v) => v.statusCode)).containEql(StatusCodes.Good);
        should(seen.map((v) => v.value.value)).containEql(value);
    });
});
