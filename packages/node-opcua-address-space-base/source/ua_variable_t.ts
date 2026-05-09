import type { QualifiedNameLike } from "node-opcua-data-model";
import type { DataValueT } from "node-opcua-data-value";
import type { NumericRange } from "node-opcua-numeric-range";
import type { CallbackT, StatusCode, StatusCodeCallback } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";
import type { ISessionContext } from "./session_context";
import type { UAVariable } from "./ua_variable";

export interface UAVariableT<T, DT extends DataType> extends UAVariable {
    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValueT<T, DT>;

    readValueAsync(context: ISessionContext | null): Promise<DataValueT<T, DT>>;
    readValueAsync(context: ISessionContext | null, callback: CallbackT<DataValueT<T, DT>>): void;

    writeValue(
        context: ISessionContext,
        dataValue: DataValueT<T, DT>,
        indexRange: NumericRange | null,
        callback: StatusCodeCallback
    ): void;

    writeValue(context: ISessionContext, dataValue: DataValueT<T, DT>, callback: StatusCodeCallback): void;
    writeValue(context: ISessionContext, dataValue: DataValueT<T, DT>, indexRange?: NumericRange | null): Promise<StatusCode>;
}
