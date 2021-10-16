import { QualifiedNameLike } from "node-opcua-data-model";
import { DataValueOptionsT, DataValueT } from "node-opcua-data-value";
import { NumericRange } from "node-opcua-numeric-range";
import { CallbackT, StatusCode, StatusCodeCallback } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { ISessionContext } from "./session_context";
import { UAVariable } from "./ua_variable";

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
