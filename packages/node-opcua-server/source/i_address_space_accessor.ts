import { ISessionContext } from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";
import { StatusCode } from "node-opcua-status-code";
import { BrowseDescriptionOptions, BrowseResult, ReadRequestOptions, WriteValue, CallMethodRequest, CallMethodResultOptions, HistoryReadRequest, HistoryReadResult } from "node-opcua-types";

export interface IAddressSpaceAccessor {
    browse(context: ISessionContext, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]>;
    read(context: ISessionContext, readRequest: ReadRequestOptions): Promise<DataValue[]>;
    write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]>;
    historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]>;
}
