/**
 * @module node-opcua-client
 */

import type { EventEmitter } from "events";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { MonitoringParametersOptions } from "node-opcua-types";

import type { ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction } from "./client_monitored_item_base";
import type { ClientSubscription } from "./client_subscription";

// tslint:disable:unified-signatures
export interface ClientMonitoredItemGroup extends EventEmitter, ClientMonitoredItemOrGroupAction {
    on(event: "changed", eventHandler: (monitoredItem: ClientMonitoredItemBase, dataValue: DataValue, index: number) => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;

    on(event: "terminated", eventHandler: (error: Error) => void): this;

    on(event: "initialized", eventHandler: () => void): this;
}

export interface ClientMonitoredItemGroup {
    monitoredItems: ClientMonitoredItemBase[];
}

export class ClientMonitoredItemGroup {
    public static create(
        subscription: ClientSubscription,
        itemsToMonitor: any[],
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): ClientMonitoredItemGroup {
        /* c8 ignore next*/
        throw new Error("Not implemented");
    }
}
