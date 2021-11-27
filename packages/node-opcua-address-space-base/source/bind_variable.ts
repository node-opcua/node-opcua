import { Variant, VariantLike } from "node-opcua-variant";
import { CallbackT, StatusCode, StatusCodeCallback } from "node-opcua-status-code";
import {
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-types";
import { NumericRange } from "node-opcua-numeric-range";
import { QualifiedNameLike } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";

import { UAVariable } from "./ua_variable";
import { ContinuationData, ISessionContext } from "./session_context";

export type VariableSetterVariation1 = (this: UAVariable, value: Variant) => StatusCode;

export type VariableSetterVariation2 = (this: UAVariable, value: Variant, callback: CallbackT<StatusCode>) => void;

export type VariableSetter = VariableSetterVariation1 | VariableSetterVariation2;

export type HistoryReadFunc = (
    context: ISessionContext,
    historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) => void;

export type GetFunc = (this: UAVariable) => Variant;
export type SetFunc = VariableSetter | null;

export type VariableDataValueGetterSync = (this: UAVariable) => DataValue;
export type VariableDataValueGetterPromise = (this: UAVariable) => Promise<DataValue>;
export type VariableDataValueGetterCallback = (this: UAVariable, callback: CallbackT<DataValue>) => void;

export type VariableDataValueSetterWithCallback = (this: UAVariable, dataValue: DataValue, callback: CallbackT<StatusCode>) => void;
export type VariableDataValueSetterWithPromise = (this: UAVariable, dataValue: DataValue) => Promise<StatusCode>;

export type TimestampGetFunc = VariableDataValueGetterSync | VariableDataValueGetterPromise | VariableDataValueGetterCallback;
export type TimestampSetFunc = VariableDataValueSetterWithCallback | VariableDataValueSetterWithPromise;

export interface BindVariableOptionsVariation1 {
    get: GetFunc;
    set?: SetFunc;
    timestamped_get?: undefined;
    timestamped_set?: undefined;
    historyRead?: HistoryReadFunc;
}
export interface BindVariableOptionsVariation2 {
    set?: undefined;
    get?: undefined;
    timestamped_get: TimestampGetFunc;
    timestamped_set?: TimestampSetFunc;
    historyRead?: HistoryReadFunc;
}

export interface BindVariableOptionsVariation3 {
    set?: undefined;
    get?: undefined;
    timestamped_get?: undefined;
    timestamp_set?: undefined;
    refreshFunc?: (callback: CallbackT<DataValue>) => void;
    historyRead?: HistoryReadFunc;
}
export interface BindVariableOptionsVariation4 extends VariantLike {
    set?: undefined;
    get?: undefined;
    timestamped_get?: undefined;
    timestamp_set?: undefined;
    refreshFunc?: (callback: CallbackT<DataValue>) => void;
    historyRead?: HistoryReadFunc;
}

export type BindVariableOptions =
    | BindVariableOptionsVariation1
    | BindVariableOptionsVariation2
    | BindVariableOptionsVariation3
    | BindVariableOptionsVariation4;
