import { makeRoles, WellKnownRoles } from "node-opcua-address-space";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoredItemCreateRequest, MonitoringMode, PublishRequest } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import type { MonitoredItemNotification } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import type { MonitoredItem } from "../source/monitored_item.js";
import { prepareMonitoredItem } from "../source/opcua_server.js";
import { ServerEngine } from "../source/server_engine.js";
import type { ServerSession } from "../source/server_session.js";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A subscription keeps its monitored items when its session closes without deleting it (a timeout
 * does that), and the same user can take it over with TransferSubscriptions. The values the items
 * queue meanwhile, and the values resent after the transfer, go to the new session: each must be
 * what a Read gives that session.
 */
describe("subscription transfer: the values queued and resent follow the Read result of the session", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));
    let engine: ServerEngine;
    let secretNodeId: string;
    let secret: { setValueFromSource(value: Variant): void };

    before(async () => {
        engine = new ServerEngine({ applicationUri: "urn:test:transfer:read-results" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard }, (err) => (err ? reject(err) : resolve()))
        );
        const namespace = engine.addressSpace?.getOwnNamespace();
        const variable = namespace?.addVariable({
            browseName: "Secret",
            organizedBy: engine.addressSpace?.rootFolder.objects,
            dataType: "Double",
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            minimumSamplingInterval: 0,
            // Operators read it; other sessions may browse it, not read it
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read },
                { roleId: resolveNodeId(WellKnownRoles.AuthenticatedUser), permissions: PermissionFlag.Browse }
            ],
            value: { dataType: DataType.Double, value: 1 }
        });
        secretNodeId = variable?.nodeId.toString() as string;
        secret = variable as unknown as { setValueFromSource(value: Variant): void };
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    /** a session of a user who is not an Operator (or who is, for the control case) */
    function userSession(operator = false): ServerSession {
        const session = engine.createSession({ sessionTimeout: 100000 });
        const roles = operator ? [WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator] : [WellKnownRoles.AuthenticatedUser];
        session.sessionContext.getCurrentUserRoles = () => makeRoles(roles);
        return session;
    }

    const valuesOf = (monitoredItem: MonitoredItem): DataValue[] =>
        monitoredItem.queue.map((notification) => (notification as MonitoredItemNotification).value);
    const leaked = (values: DataValue[]) => values.filter((v) => v.statusCode.isGood()).map((v) => v.value.value);

    const cases = [
        { name: "TRR-1", samplingInterval: 0, operator: false },
        { name: "TRR-2", samplingInterval: 50, operator: false },
        { name: "TRR-3", samplingInterval: 0, operator: true },
        { name: "TRR-4", samplingInterval: 50, operator: true }
    ];
    for (const { name, samplingInterval, operator } of cases) {
        const title = operator
            ? "an Operator's item keeps its values while its session is closed, and gets them after the transfer"
            : "an item of a closed session queues no value that the user may not read, and the new owner gets none";
        it(`${name} (samplingInterval ${samplingInterval}) ${title}`, async () => {
            const session1 = userSession(operator);
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 0
            });
            subscription.on("monitoredItem", (monitoredItem: MonitoredItem) =>
                prepareMonitoredItem(session1.sessionContext, engine.nodeFinder, monitoredItem)
            );
            const result = await subscription.createMonitoredItem(
                engine.nodeFinder,
                TimestampsToReturn.Both,
                new MonitoredItemCreateRequest({
                    itemToMonitor: { nodeId: secretNodeId, attributeId: AttributeIds.Value },
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: { clientHandle: 1, samplingInterval, queueSize: 100, discardOldest: true }
                })
            );
            should(result.statusCode).eql(StatusCodes.Good);
            const monitoredItem = subscription.getMonitoredItem(result.monitoredItemId) as MonitoredItem;
            await pause(150);
            // control: while the session is open, the item gives what a Read gives
            should(leaked(valuesOf(monitoredItem)).length).eql(operator ? 1 : 0, "the values while the session is open");
            monitoredItem.queue.length = 0;

            // the session closes and keeps its subscription, as a timeout does
            await engine.closeSession(session1.authenticationToken, /* deleteSubscriptions */ false, "Timeout");
            for (let k = 2; k <= 4; k++) {
                secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1000 + k }));
                await pause(80);
            }
            const queuedWhileOrphan = leaked(valuesOf(monitoredItem));

            // the same user takes the subscription over
            const session2 = userSession(operator);
            const transfer = await engine.transferSubscription(session2, subscription.id, /* sendInitialValues */ true);
            should(transfer.statusCode).eql(StatusCodes.Good);
            await pause(150);
            const afterTransfer = leaked(valuesOf(monitoredItem));
            // what the new session receives: the messages it can republish, and its next Publish responses
            const published: number[] = [];
            const collect = (message: unknown) => {
                const data = (message as { notificationData?: unknown[] } | null)?.notificationData ?? [];
                for (const notification of data) {
                    const items = (notification as { monitoredItems?: MonitoredItemNotification[] }).monitoredItems ?? [];
                    for (const item of items) {
                        if (item.value.statusCode.isGood()) published.push(item.value.value.value as number);
                    }
                }
            };
            for (const sequenceNumber of transfer.availableSequenceNumbers ?? []) {
                collect(subscription.getMessageForSequenceNumber(sequenceNumber));
            }
            await new Promise<void>((resolve) => {
                session2.publishEngine._on_PublishRequest(
                    new PublishRequest({ requestHeader: { requestHandle: 7 } }),
                    (_request, response) => {
                        collect((response as { notificationMessage?: unknown }).notificationMessage);
                        resolve();
                    }
                );
            });

            if (operator) {
                // the user may read the node: the values of the gap reach the new session
                should(queuedWhileOrphan.length + published.length).be.above(0, "the values queued while the session was closed");
                should([...queuedWhileOrphan, ...published, ...afterTransfer]).containEql(1004);
            } else {
                should(queuedWhileOrphan).eql([], "no value queued while the subscription has no session");
                should(afterTransfer).eql([], "no value goes to the new session");
                should(published).eql([], "the new session receives no value");
            }
            await engine.closeSession(session2.authenticationToken, /* deleteSubscriptions */ true, "CloseSession");
        });
    }
});
