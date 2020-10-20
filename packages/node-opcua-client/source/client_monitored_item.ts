/**
 * @module node-opcua-client
 */
import { EventEmitter } from "events";

import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { Variant } from "node-opcua-variant";

import { MonitoringMode, MonitoringParametersOptions } from "node-opcua-types";
import { ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction } from "./client_monitored_item_base";
import { ClientSubscription } from "./client_subscription";

// tslint:disable:unified-signatures
export interface ClientMonitoredItem extends ClientMonitoredItemBase, ClientMonitoredItemOrGroupAction, EventEmitter {
    on(event: "changed", eventHandler: (dataValue: DataValue) => void): this;
    on(event: "changed", eventHandler: (values: Variant[]) => void): this;

    on(event: "terminated", eventHandler: () => void): this;

    on(event: "initialized", eventHandler: () => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;
}

export class ClientMonitoredItem {
    public static create(
        subscription: ClientSubscription,
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn = TimestampsToReturn.Neither
    ): ClientMonitoredItem {
        /* istanbul ignore next*/
        throw new Error("unimplemented");
    }
}
