import { Variant } from "node-opcua-variant";
import { CallbackT, StatusCode } from "node-opcua-status-code";
import {
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-types";
import { NumericRange } from "node-opcua-numeric-range";
import { QualifiedNameLike } from "node-opcua-data-model";

import { UAVariable } from "./ua_variable";
import { ISessionContext } from "./session_context";
import { ContinuationPoint } from "./continuation_point";

export type VariableSetterVariation1 = (this: UAVariable, value: Variant) => StatusCode;

export type VariableSetterVariation2 = (
    this: UAVariable,
    value: Variant,
    callback: (err: Error | null, statusCode: StatusCode) => void
) => void;

export type VariableSetter = VariableSetterVariation1 | VariableSetterVariation2;

export type HistoryReadFunc = (
    context: ISessionContext,
    historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationPoint: ContinuationPoint | null,
    callback: CallbackT<HistoryReadResult>
) => void;

export type GetFunc = (this: UAVariable) => Variant;
export type SetFunc = VariableSetter | null;

export interface BindVariableOptionsVariation1 {
    get: GetFunc;
    set?: SetFunc;
    timestamped_get?: undefined;
    timestamped_set?: undefined;
    historyRead?: HistoryReadFunc;
}
