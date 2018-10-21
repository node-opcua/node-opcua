/**
 * @module bode-opcua-client
 */
import { EventEmitter } from "events";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";

import { ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction } from "./client_monitored_item_base";
import { ClientSubscription } from "./client_subscription";

// tslint:disable:unified-signatures
export interface ClientMonitoredItemGroup extends EventEmitter, ClientMonitoredItemOrGroupAction {

    on(event: "changed", eventHandler: (dataValue: DataValue) => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;

    on(event: "terminated", eventHandler: () => void): this;

    on(event: "initialized", eventHandler: () => void): this;

}

export class ClientMonitoredItemGroup {
    public static create(
        subscription: ClientSubscription,
        itemsToMonitor: any[],
        monitoringParameters: any,
        timestampsToReturn: TimestampsToReturn
    ): ClientMonitoredItemGroup {
        throw new Error("Not implemented");
    }
}
