/**
 * @module node-opcua-client
 */

import type { EventEmitter } from "node:events";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { ReadValueIdOptions } from "node-opcua-service-read";
import type { MonitoringParametersOptions } from "node-opcua-types";

import type { ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction } from "./client_monitored_item_base.js";
import type { ClientSubscription } from "./client_subscription.js";

export interface ClientMonitoredItemGroup extends EventEmitter, ClientMonitoredItemOrGroupAction {
    on(event: "changed", eventHandler: (monitoredItem: ClientMonitoredItemBase, dataValue: DataValue, index: number) => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;

    on(event: "terminated", eventHandler: (error: Error) => void): this;

    on(event: "initialized", eventHandler: () => void): this;
}

export interface ClientMonitoredItemGroup {
    monitoredItems: ClientMonitoredItemBase[];
}

export namespace ClientMonitoredItemGroup {
    // reassigned in private/client_monitored_item_group_impl.ts to install the real
    // implementation; biome's useConst can't see that cross-module write.
    // biome-ignore lint/style/useConst: intentionally mutable, see above
    export let create = (
        _subscription: ClientSubscription,
        _itemsToMonitor: ReadValueIdOptions[],
        _monitoringParameters: MonitoringParametersOptions,
        _timestampsToReturn: TimestampsToReturn
    ): ClientMonitoredItemGroup => {
        /* c8 ignore next*/
        throw new Error("Not implemented");
    };
}
