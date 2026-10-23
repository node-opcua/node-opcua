import type { QualifiedNameLike } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { NumericRange } from "node-opcua-numeric-range";
import type { CallbackT, StatusCode } from "node-opcua-status-code";
import type {
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-types";
import type { Variant, VariantLike } from "node-opcua-variant";
import type { ContinuationData, ISessionContext } from "./session_context.js";
import type { UAVariable } from "./ua_variable.js";

export type VariableSetterVariation1 = (this: UAVariable, value: Variant) => StatusCode;

/**
 * A callback-style setter may declare the session context of the write as a third parameter
 * (and, for a write to part of an array, the index range as a fourth): `context` is undefined
 * for a write that does not come from a session.
 */
export type VariableSetterVariation2 = (
    this: UAVariable,
    value: Variant,
    callback: CallbackT<StatusCode>,
    context?: ISessionContext,
    indexRange?: NumericRange | null
) => void;
export type VariableSetterVariation3 = (this: UAVariable, value: Variant) => Promise<StatusCode>;

export type VariableSetter = VariableSetterVariation1 | VariableSetterVariation2 | VariableSetterVariation3;

export type HistoryReadFunc = (
    context: ISessionContext,
    historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) => void;

export type GetFunc = (this: UAVariable) => Variant | StatusCode;
export type SetFunc = VariableSetter | null;

export type VariableDataValueGetterSync = (this: UAVariable) => DataValue;
export type VariableDataValueGetterPromise = (this: UAVariable) => Promise<DataValue>;
/** a callback-style getter may declare the session context of the read as a second parameter */
export type VariableDataValueGetterCallback = (this: UAVariable, callback: CallbackT<DataValue>, context?: ISessionContext) => void;

/** a callback-style setter may declare the session context as a third parameter, and the index range as a fourth */
export type VariableDataValueSetterWithCallback = (
    this: UAVariable,
    dataValue: DataValue,
    callback: CallbackT<StatusCode>,
    context?: ISessionContext,
    indexRange?: NumericRange | null
) => void;
export type VariableDataValueSetterWithPromise = (this: UAVariable, dataValue: DataValue) => Promise<StatusCode>;

/** what a `timestamped_get_ctx` getter is told about the read */
export interface VariableReadContext {
    /** the session context of the read; undefined when the read does not come from a session */
    context?: ISessionContext;
}

/** what a `timestamped_set_ctx` setter is told about the write */
export interface VariableWriteContext {
    /** the session context of the write; undefined when the write does not come from a session */
    context?: ISessionContext;
    /** the part of the array being written, null or empty for a write of the whole value */
    indexRange?: NumericRange | null;
}

/** an asynchronous getter that is told who reads: bound with `timestamped_get_ctx` */
export type VariableDataValueGetterWithContext = (this: UAVariable, options: VariableReadContext) => Promise<DataValue>;

/** an asynchronous setter that is told who writes: bound with `timestamped_set_ctx` */
export type VariableDataValueSetterWithContext = (
    this: UAVariable,
    dataValue: DataValue,
    options: VariableWriteContext
) => Promise<StatusCode>;

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
    /** instead of timestamped_set, to be told who writes */
    timestamped_set_ctx?: VariableDataValueSetterWithContext;
    historyRead?: HistoryReadFunc;
}

/** an asynchronous getter that is told who reads, and optionally a setter that is told who writes */
export interface BindVariableOptionsVariation5 {
    set?: undefined;
    get?: undefined;
    timestamped_get?: undefined;
    timestamped_set?: undefined;
    timestamped_get_ctx: VariableDataValueGetterWithContext;
    timestamped_set_ctx?: VariableDataValueSetterWithContext;
    historyRead?: HistoryReadFunc;
}

export interface BindVariableOptionsVariation3 {
    set?: undefined;
    get?: undefined;
    timestamped_get?: undefined;
    timestamped_set?: undefined;
    refreshFunc?: (callback: CallbackT<DataValue>, context?: ISessionContext) => void;
    historyRead?: HistoryReadFunc;
}
export interface BindVariableOptionsVariation4 extends VariantLike {
    set?: undefined;
    get?: undefined;
    timestamped_get?: undefined;
    timestamped_set?: undefined;
    refreshFunc?: (callback: CallbackT<DataValue>, context?: ISessionContext) => void;
    historyRead?: HistoryReadFunc;
}

export type BindVariableOptions =
    | BindVariableOptionsVariation1
    | BindVariableOptionsVariation2
    | BindVariableOptionsVariation3
    | BindVariableOptionsVariation4
    | BindVariableOptionsVariation5;
