import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type {
    CreateSubscriptionRequestOptions,
    MonitoringMode,
    MonitoringParametersOptions,
    ReadValueIdOptions
} from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { IBasicSessionAsync } from "./basic_session_interface";

export interface IBasicMonitoredItem {
    // a data-change monitored item reports a DataValue per change, while an event
    // monitored item (created with an EventFilter) reports the selected event
    // fields as a Variant array instead.
    on(eventName: "changed", eventHandler: (dataValue: DataValue) => void): this;
    on(eventName: "changed", eventHandler: (eventFields: Variant[]) => void): this;
    once(eventName: "changed", eventHandler: (dataValue: DataValue) => void): this;
    once(eventName: "changed", eventHandler: (eventFields: Variant[]) => void): this;
}
export interface IBasicSubscription {
    subscriptionId: number;
    _createMonitoredItem(
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): IBasicMonitoredItem;
    monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        monitoringMode?: MonitoringMode
    ): Promise<IBasicMonitoredItem>;
    terminate(): Promise<void>;
}

export interface IBasicSessionEx extends IBasicSessionAsync {
    requestedMaxReferencesPerNode: number;
    isReconnecting: boolean;
    createSubscription2(createSubscriptionRequest: CreateSubscriptionRequestOptions): Promise<IBasicSubscription>;
}
