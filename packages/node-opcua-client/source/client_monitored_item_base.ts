/**
 * @module node-opcua-client
 */
import type { EventEmitter } from "events";
import { type AttributeIds, UInt32 } from "node-opcua-basic-types";
import type { QualifiedNameLike } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import type { TimestampsToReturn } from "node-opcua-service-read";
import type {
    MonitoredItemCreateResult,
    MonitoringMode,
    MonitoringParameters,
    MonitoringParametersOptions
} from "node-opcua-service-subscription";
import type { Callback, ErrorCallback, StatusCode } from "node-opcua-status-code";
import type { Variant } from "node-opcua-variant";

import type { ClientSubscription } from "./client_subscription";

// tslint:disable:unified-signatures
export interface ClientMonitoredItemOrGroupAction {
    modify(parameters: MonitoringParametersOptions, timestampsToReturn?: TimestampsToReturn): Promise<StatusCode>;
    modify(parameters: MonitoringParametersOptions, callback: Callback<StatusCode>): void;
    modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn | null,
        callback: Callback<StatusCode>
    ): void;

    setMonitoringMode(monitoringMode: MonitoringMode): Promise<StatusCode>;
    setMonitoringMode(monitoringMode: MonitoringMode, callback: Callback<StatusCode>): void;

    terminate(): Promise<void>;
    terminate(done: ErrorCallback): void;
}

// tslint:disable:unified-signatures
export interface ClientMonitoredItemBase extends EventEmitter, ClientMonitoredItemOrGroupAction {
    on(event: "changed", eventHandler: (dataValue: DataValue) => void): this;
    on(event: "changed", eventHandler: (values: Variant[]) => void): this;

    on(event: "err", eventHandler: (message: string) => void): this;

    on(event: "terminated", eventHandler: () => void): this;

    on(event: "initialized", eventHandler: () => void): this;
}

export interface ClientMonitoredItemBase {
    readonly itemToMonitor: {
        nodeId: NodeId;
        attributeId: AttributeIds;
        indexRange?: NumericRange | undefined;
        dataEncoding?: QualifiedNameLike | null;
    };
    readonly monitoringParameters: MonitoringParameters;
    readonly subscription: ClientSubscription;
    readonly monitoringMode: MonitoringMode;
    readonly statusCode: StatusCode;
    readonly monitoredItemId?: any;
    readonly result?: MonitoredItemCreateResult;
    readonly filterResult?: ExtensionObject;
}
