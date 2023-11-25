import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { ReadValueIdOptions, MonitoringParametersOptions, CreateSubscriptionRequestOptions } from "node-opcua-types";
import { IBasicSessionAsync } from "./basic_session_interface";

export interface IBasicMonitoredItem {
    on(eventName: "changed", eventHandler: (dataValue: DataValue) => void): this;
    once(eventName: "changed", eventHandler: (dataValue: DataValue) => void): this;
}
export interface IBasicSubscription {
    subscriptionId: number;
    _createMonitoredItem(
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): IBasicMonitoredItem;

    terminate(): Promise<void>;
}

export interface IBasicSessionEx extends IBasicSessionAsync {
    requestedMaxReferencesPerNode: number;
    isReconnecting: boolean;
    createSubscription2(createSubscriptionRequest: CreateSubscriptionRequestOptions): Promise<IBasicSubscription>;
}
