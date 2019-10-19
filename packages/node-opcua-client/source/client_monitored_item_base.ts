/**
 * @module node-opcua-client
 */
import { EventEmitter } from "events";

import { ExtensionObject } from "node-opcua-extension-object";
import {
    ReadValueId, TimestampsToReturn
} from "node-opcua-service-read";
import {
    MonitoredItemCreateResult,
    MonitoringMode,
    MonitoringParameters, MonitoringParametersOptions,
} from "node-opcua-service-subscription";
import { StatusCode } from "node-opcua-status-code";

import { DataValue } from "node-opcua-data-value";
import { ClientSubscription } from "./client_subscription";
import { Callback, ErrorCallback } from "./common";

// tslint:disable:unified-signatures
export interface ClientMonitoredItemOrGroupAction  {

    modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<StatusCode>;
    modify(
        parameters: MonitoringParametersOptions,
        callback: Callback<StatusCode>): void;
    modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn | null,
        callback: Callback<StatusCode> ): void;
    modify(...args: any[]): any;

    setMonitoringMode(monitoringMode: MonitoringMode): Promise<StatusCode>;
    setMonitoringMode(monitoringMode: MonitoringMode, callback: Callback<StatusCode>): void;
    setMonitoringMode(...args: any[]): any;

    terminate(): Promise<void>;
    terminate(done: ErrorCallback): void;
    terminate(...args: any[]): any;
}

// tslint:disable:unified-signatures
export interface ClientMonitoredItemBase  extends EventEmitter, ClientMonitoredItemOrGroupAction {

    on(event: "changed", eventHandler: (dataValue: DataValue) => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;

    on(event: "terminated", eventHandler: () => void): this;

    on(event: "initialized", eventHandler: () => void): this;

}

export interface ClientMonitoredItemBase  {

    itemToMonitor: ReadValueId;
    monitoringParameters: MonitoringParameters;
    subscription: ClientSubscription;
    monitoringMode: MonitoringMode;
    statusCode: StatusCode;
    monitoredItemId?: any;
    result?: MonitoredItemCreateResult;
    filterResult?: ExtensionObject;

}
