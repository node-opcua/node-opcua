import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { ReadValueIdOptions, MonitoringParametersOptions, CreateSubscriptionRequestOptions } from "node-opcua-types";
import { IBasicSession } from "./basic_session_interface";

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
}

export interface IBasicSessionEx extends IBasicSession {
    requestedMaxReferencesPerNode: number;
    isReconnecting: boolean;
    createSubscription2(createSubscriptionRequest: CreateSubscriptionRequestOptions): Promise<IBasicSubscription>;
}
