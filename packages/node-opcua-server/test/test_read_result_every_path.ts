import { EventEmitter } from "node:events";
import {
    type CompactAddressSpace,
    type INamespaceDataAccess,
    makeRoles,
    SessionContext,
    type UAAnalogItem,
    WellKnownRoles
} from "node-opcua-address-space";
import type { ISessionBase, ISubscriptionBase } from "node-opcua-address-space-base";
import type { StoreVariableView } from "node-opcua-address-space-store";
import { AttributeIds, NodeClass, PermissionFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId, type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { ReadValueId, TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, type MonitoredItemNotification, MonitoringParameters, Range } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions, ServerEngine } from "../source/index.js";
import { prepareMonitoredItem } from "../source/opcua_server.js";
import { type ValueReadOwner, valueReadStatus } from "../source/value_for_session.js";

/**
 * One restricted Variable, the same three contexts (a session that may read it, a session that may not,
 * an in-process caller), and every path that hands its Value to a session: the Read service, the answer
 * of the owner, and each delivery of a monitored item (initial value, sample, value change, semantic
 * change). Every path gives the same answer, for a node object and for a compact view alike.
 */
describe("one read result for the services and the subscriptions", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let engine: ServerEngine;
    let nodeObject: UAAnalogItem<number, DataType.Double>;
    let compactView: StoreVariableView;
    const monitoredItems: MonitoredItem[] = [];
    let nextMonitoredItemId = 1;
    let nextValue = 100;

    const SECRET = 1234;
    const onlyOperator = [
        { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read }
    ];

    const contextForRoles = (...roles: WellKnownRoles[]): SessionContext => {
        const session = { channel: { securityMode: MessageSecurityMode.SignAndEncrypt } } as unknown as ISessionBase;
        const context = new SessionContext({ session });
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    };

    const contexts: { name: string; context: () => SessionContext; expected: StatusCode }[] = [
        { name: "allowed session", context: () => contextForRoles(WellKnownRoles.Operator), expected: StatusCodes.Good },
        {
            name: "refused session",
            context: () => contextForRoles(WellKnownRoles.Anonymous),
            expected: StatusCodes.BadUserAccessDenied
        },
        { name: "in-process", context: () => new SessionContext(), expected: StatusCodes.Good }
    ];

    before(async () => {
        engine = new ServerEngine({ applicationUri: "urn:test:one-read-result" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        const addressSpace = engine.addressSpace;
        if (!addressSpace) throw new Error("no address space");
        const namespace = addressSpace.getOwnNamespace() as unknown as INamespaceDataAccess;
        nodeObject = namespace.addAnalogDataItem<number, DataType.Double>({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SecretObject",
            engineeringUnitsRange: { low: 0, high: 100 },
            dataType: "Double",
            minimumSamplingInterval: 0,
            rolePermissions: onlyOperator,
            value: new Variant({ dataType: DataType.Double, value: SECRET })
        });

        const compact = engine.compactAddressSpace as CompactAddressSpace;
        const ns = engine.registerCompactNamespace("urn:test:one-read-result:plant");
        compactView = compact.addVariable({
            nodeId: `ns=${ns};s=SecretView`,
            browseName: "SecretView",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            minimumSamplingInterval: 0,
            rolePermissions: onlyOperator,
            value: { dataType: DataType.Double, value: SECRET }
        }) as unknown as StoreVariableView;
    });

    afterEach(() => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        monitoredItems.length = 0;
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    /** an item of a session with `sessionContext`; every value it is handed is kept, before its trigger filters it */
    async function makeItem(
        node: unknown,
        nodeId: NodeId,
        sessionContext: SessionContext,
        samplingInterval: number
    ): Promise<{ monitoredItem: MonitoredItem; handed: DataValue[] }> {
        const monitoredItemId = nextMonitoredItemId++;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: null,
            itemToMonitor: new ReadValueId({ nodeId, attributeId: AttributeIds.Value }),
            minSupportedSampleRate: 0,
            monitoredItemId,
            queueSize: 100,
            samplingInterval,
            timestampsToReturn: TimestampsToReturn.Both
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);
        const handed: DataValue[] = [];
        const recordValue = monitoredItem.recordValue.bind(monitoredItem);
        monitoredItem.recordValue = (dataValue, ...rest) => {
            handed.push(dataValue);
            return recordValue(dataValue, ...rest);
        };
        const subscription = { id: monitoredItemId, $session: { sessionContext } } as unknown as ISubscriptionBase;
        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(node as never);
        // the sampling function the server installs: a read of the node in the session context
        prepareMonitoredItem(sessionContext, engine.nodeFinder, monitoredItem);
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        await new Promise<void>((resolve) => setImmediate(resolve));
        await new Promise<void>((resolve) => setImmediate(resolve));
        return { monitoredItem, handed };
    }

    /** the answer of each path, by path name */
    async function answers(
        node: ValueReadOwner & { nodeId: NodeId; readValueStatus(context: SessionContext): StatusCode },
        setValue: (value: number) => void,
        semanticChange: (() => void) | null,
        sessionContext: SessionContext
    ): Promise<Map<string, DataValue | StatusCode>> {
        const result = new Map<string, DataValue | StatusCode>();

        // the services
        const [read] = engine.readSync(sessionContext, { nodesToRead: [{ nodeId: node.nodeId, attributeId: AttributeIds.Value }] });
        result.set("Read service", read);
        result.set("owner answer", node.readValueStatus(sessionContext));
        result.set("shared helper", valueReadStatus(node, sessionContext) as StatusCode);

        // an exception-based item: its initial value, then a value change
        const exception = await makeItem(node, node.nodeId, sessionContext, 0);
        should(exception.monitoredItem.isExceptionBased).eql(true);
        result.set("initial value", exception.handed[0]);
        exception.handed.length = 0;
        setValue(nextValue++);
        result.set("value change", exception.handed[0]);

        // a semantic change, on a node that has one
        if (semanticChange) {
            exception.handed.length = 0;
            exception.monitoredItem.queue.length = 0; // a semantic change sends a value only when none is queued
            semanticChange();
            result.set("semantic change", exception.handed[0]);
        }

        // a sampled item: one sample, as the sampler takes it
        const sampled = await makeItem(node, node.nodeId, sessionContext, 60_000);
        should(sampled.monitoredItem.isExceptionBased).eql(false);
        const sample = await new Promise<DataValue>((resolve, reject) => {
            sampled.monitoredItem.samplingFunc?.call(
                sampled.monitoredItem,
                sessionContext,
                sampled.monitoredItem.oldDataValue,
                (err: Error | null, dataValue?: DataValue) => (err || !dataValue ? reject(err) : resolve(dataValue))
            );
        });
        result.set("sample", sample);
        return result;
    }

    const statusOf = (answer: DataValue | StatusCode | undefined): string => {
        if (answer === undefined) return "nothing";
        const statusCode = "statusCode" in answer ? answer.statusCode : answer;
        return statusCode.name.split("#")[0];
    };

    const owners = [
        {
            owner: "a node object",
            node: () => nodeObject as never,
            setValue: (value: number) => nodeObject.setValueFromSource(new Variant({ dataType: DataType.Double, value })),
            semanticChange: () => {
                nodeObject.euRange.setValueFromSource(
                    new Variant({ dataType: DataType.ExtensionObject, value: new Range({ low: 0, high: nextValue++ }) })
                );
            }
        },
        {
            owner: "a compact view",
            node: () => compactView as never,
            setValue: (value: number) => compactView.setValueFromSource(new Variant({ dataType: DataType.Double, value })),
            semanticChange: null
        }
    ];

    for (const { owner, node, setValue, semanticChange } of owners) {
        for (const { name, context, expected } of contexts) {
            it(`ORR ${owner}, ${name}: every path gives ${expected.name}`, async () => {
                const byPath = await answers(node(), setValue, semanticChange, context());
                const statuses = Object.fromEntries([...byPath].map(([path, answer]) => [path, statusOf(answer)]));
                const same = Object.fromEntries([...byPath.keys()].map((path) => [path, expected.name]));
                should(statuses).eql(same);
                // a refused path never carries a value of the node
                if (expected !== StatusCodes.Good) {
                    for (const [path, answer] of byPath) {
                        if ("statusCode" in answer) {
                            should(answer.value.value).not.eql(SECRET, path);
                            should(answer.value.dataType).eql(DataType.Null, path);
                        }
                    }
                }
            });
        }
    }

    for (const { owner, node } of owners) {
        it(`ORR ${owner}: a value resent after a transfer goes to the new session as its Read gives it`, async () => {
            const target = node() as { nodeId: NodeId };
            const { monitoredItem } = await makeItem(target, target.nodeId, contextForRoles(WellKnownRoles.Operator), 0);
            // the item has recorded a readable value for its first session
            should(monitoredItem.queue.length).be.above(0);
            // the subscription moves to a session that may not read the node
            const refused = contextForRoles(WellKnownRoles.Anonymous);
            monitoredItem.$subscription = {
                id: 999,
                $session: { sessionContext: refused }
            } as unknown as MonitoredItem["$subscription"];
            monitoredItem.queue.length = 0;
            await monitoredItem.resendInitialValue();
            const resent = monitoredItem.queue.map((notification) => (notification as MonitoredItemNotification).value);
            should(resent.map((dataValue) => dataValue.statusCode.name.split("#")[0])).eql([StatusCodes.BadUserAccessDenied.name]);
            should(resent[0].value.value).not.eql(SECRET);
        });
    }

    it("ORR a node no owner answers for is refused to a session, and given to an in-process caller", () => {
        const anonymous = {} as ValueReadOwner;
        should(valueReadStatus(anonymous, contextForRoles(WellKnownRoles.Operator))).eql(StatusCodes.BadUserAccessDenied);
        should(valueReadStatus(anonymous, new SessionContext())).eql(StatusCodes.Good);
    });
});

/**
 * The owner of a node that answers later (the engine, for a stand-in of a node another thread owns), and a
 * node whose owner gives no answer at all, through a real monitored item.
 */
describe("one read result: owners that answer later, and nodes no owner answers for", function (this: Mocha.Suite) {
    const contextFor = (...roles: WellKnownRoles[]): SessionContext => {
        const session = { channel: { securityMode: MessageSecurityMode.SignAndEncrypt } } as unknown as ISessionBase;
        const context = new SessionContext({ session });
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    };
    const good = (value: number) => new DataValue({ value: new Variant({ dataType: DataType.Double, value }) });

    /** a Variable node with no read checks of its own */
    class PlainNode extends EventEmitter {
        nodeId = coerceNodeId("ns=1;s=Plain");
        browseName = { name: "Plain" };
        nodeClass = NodeClass.Variable;
        dataType = coerceNodeId(DataType.Double);
        minimumSamplingInterval = 0;
        readValueAsync(_context: unknown, callback: (err: Error | null, dataValue?: DataValue) => void) {
            callback(null, good(1));
        }
        readAttribute() {
            return good(1);
        }
    }
    /** a stand-in whose owner answers later, as the engine answers a session worker */
    class LaterOwnerNode extends PlainNode {
        readonly pending: ((err: Error | null, dataValue?: DataValue) => void)[] = [];
        readValueForSession(_context: unknown, callback: (err: Error | null, dataValue?: DataValue) => void) {
            this.pending.push(callback);
        }
    }

    const items: MonitoredItem[] = [];
    afterEach(() => {
        for (const item of items) {
            item.terminate();
            item.dispose();
        }
        items.length = 0;
    });

    async function exceptionItem(node: PlainNode, context: SessionContext): Promise<{ item: MonitoredItem; handed: DataValue[] }> {
        const item = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            filter: null,
            itemToMonitor: new ReadValueId({ nodeId: node.nodeId, attributeId: AttributeIds.Value }),
            minSupportedSampleRate: 0,
            monitoredItemId: items.length + 1,
            queueSize: 10,
            samplingInterval: 0,
            timestampsToReturn: TimestampsToReturn.Both
        } as unknown as MonitoredItemOptions);
        items.push(item);
        const handed: DataValue[] = [];
        const recordValue = item.recordValue.bind(item);
        item.recordValue = (dataValue, ...rest) => {
            handed.push(dataValue);
            return recordValue(dataValue, ...rest);
        };
        item.$subscription = { id: 1, $session: { sessionContext: context } } as unknown as MonitoredItem["$subscription"];
        item.samplingFunc = (_context, _old, callback) => callback(null, good(2));
        item.setNode(node as never);
        item.setMonitoringMode(MonitoringMode.Reporting);
        await new Promise<void>((resolve) => setImmediate(resolve));
        should(item.isExceptionBased).eql(true);
        handed.length = 0;
        return { item, handed };
    }

    it("ORL-1 a change is handed out as the owner reads it for the session", async () => {
        const node = new LaterOwnerNode();
        const { handed } = await exceptionItem(node, contextFor(WellKnownRoles.Operator));
        node.emit("value_changed", good(555));
        should(handed.length).eql(0);
        should(node.pending.length).eql(1);
        node.pending[0](null, new DataValue({ statusCode: StatusCodes.BadUserAccessDenied }));
        should(handed.map((dataValue) => dataValue.statusCode.name)).eql([StatusCodes.BadUserAccessDenied.name]);
    });

    it("ORL-2 an answer that comes after the item turned sampled is dropped", async () => {
        const node = new LaterOwnerNode();
        const { item, handed } = await exceptionItem(node, contextFor(WellKnownRoles.Operator));
        node.emit("value_changed", good(555));
        item.modify(
            null,
            new MonitoringParameters({ clientHandle: 1, samplingInterval: 1000, queueSize: 10, discardOldest: true, filter: null })
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        should(item.isExceptionBased).eql(false);
        handed.length = 0;
        node.pending[0](null, good(777));
        should(handed.map((dataValue) => dataValue.value.value)).not.containEql(777);
        // the item stops cleanly: the late answer opened no window of an exception-based item
        should(() => item.terminate()).not.throw();
    });

    it("ORL-3 a change of a node no owner answers for is refused to a session, and given in-process", async () => {
        const forSession = new PlainNode();
        const inProcessNode = new PlainNode();
        const refused = await exceptionItem(forSession, contextFor(WellKnownRoles.Operator));
        const inProcess = await exceptionItem(inProcessNode, new SessionContext());
        forSession.emit("value_changed", good(555));
        inProcessNode.emit("value_changed", good(555));
        should(refused.handed.map((dataValue) => dataValue.statusCode.name)).eql([StatusCodes.BadUserAccessDenied.name]);
        should(refused.handed[0].value.value).not.eql(555);
        should(inProcess.handed.map((dataValue) => dataValue.value.value)).eql([555]);
    });
});
