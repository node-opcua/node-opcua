/**
 * @module node-opcua-client
 */
import type { EventEmitter } from "node:events";

import { type DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { ReadValueIdOptions } from "node-opcua-service-read";
import type { MonitoringParametersOptions } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction } from "./client_monitored_item_base.js";
import type { ClientSubscription } from "./client_subscription.js";

export interface ClientMonitoredItem extends ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction, EventEmitter {
    on(event: "changed", eventHandler: (dataValue: DataValue) => void): this;
    on(event: "changed", eventHandler: (values: Variant[]) => void): this;

    on(event: "terminated", eventHandler: () => void): this;

    on(event: "initialized", eventHandler: () => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;
}

export namespace ClientMonitoredItem {
    // reassigned in private/client_monitored_item_impl.ts to install the real
    // implementation; biome's useConst can't see that cross-module write.
    // biome-ignore lint/style/useConst: intentionally mutable, see above
    export let create = (
        _subscription: ClientSubscription,
        _itemToMonitor: ReadValueIdOptions,
        _monitoringParameters: MonitoringParametersOptions,
        _timestampsToReturn: TimestampsToReturn = TimestampsToReturn.Neither
    ): ClientMonitoredItem => {
        /* c8 ignore next*/
        throw new Error("unimplemented");
    };
}
