import { type AddressSpace, type CompactAddressSpace } from "node-opcua-address-space";
import type { ContinuationData, ISessionContext } from "node-opcua-address-space-base";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { type StatusCode } from "node-opcua-status-code";
import { type BrowseDescriptionOptions, type BrowseResult, type CallMethodRequest, type CallMethodResultOptions, HistoryReadDetails, HistoryReadRequest, HistoryReadResult, type HistoryReadValueId, type ReadRequestOptions, type ReadValueIdOptions, type WriteValue } from "node-opcua-types";
import { type ICompactBackend } from "./compact_backend.js";
import type { IAddressSpaceAccessor } from "./i_address_space_accessor.js";
interface IAddressSpaceAccessorSingle {
    browseNode(browseDescription: BrowseDescriptionOptions, context?: ISessionContext): Promise<BrowseResult>;
    readNode(context: ISessionContext, nodeToRead: ReadValueIdOptions, maxAge: number, timestampsToReturn?: TimestampsToReturn): Promise<DataValue>;
    writeNode(context: ISessionContext, writeValue: WriteValue): Promise<StatusCode>;
    callMethod(context: ISessionContext, methodToCall: CallMethodRequest): Promise<CallMethodResultOptions>;
    historyReadNode(context: ISessionContext, nodeToRead: HistoryReadValueId, historyReadDetails: HistoryReadDetails, timestampsToReturn: TimestampsToReturn, continuationData: ContinuationData): Promise<HistoryReadResult>;
}
/**
 * the namespaces a compact address space serves: a NodeId in one of them is read, written,
 * browsed and translated there, the rest on the node objects. The compact space holds the
 * standard nodeset too, so that a node of the base namespace can organize nodes of a compact
 * one: a Browse of such a node merges the references the compact space adds to it.
 */
export interface CompactNamespaces {
    space: CompactAddressSpace;
    namespaces: ReadonlySet<number>;
}
export declare class AddressSpaceAccessor implements IAddressSpaceAccessor, IAddressSpaceAccessorSingle {
    #private;
    addressSpace: AddressSpace;
    constructor(addressSpace: AddressSpace);
    /** the compact space of this thread and the namespaces it serves */
    set compact(compact: CompactNamespaces | null);
    get compact(): CompactNamespaces | null;
    /**
     * what serves the compact namespaces: the compact space of this thread (see compact), or the
     * engine thread's store as a front thread sees it
     */
    set compactBackend(backend: ICompactBackend | null);
    get compactBackend(): ICompactBackend | null;
    browse(context: ISessionContext, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]>;
    read(context: ISessionContext, readRequest: ReadRequestOptions): Promise<DataValue[]>;
    /**
     * read, without a promise: nothing in a Read is asynchronous once the Variables that need
     * it have been refreshed (see ServerEngine#refreshValues), and the Read service is the
     * busiest one a server answers.
     */
    readSync(context: ISessionContext, readRequest: ReadRequestOptions): DataValue[];
    write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]>;
    historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]>;
    browseNode(browseDescription: BrowseDescriptionOptions, context?: ISessionContext): Promise<BrowseResult>;
    readNode(context: ISessionContext, nodeToRead: ReadValueIdOptions, maxAge: number, timestampsToReturn?: TimestampsToReturn): Promise<DataValue>;
    readNodeSync(context: ISessionContext, nodeToRead: ReadValueIdOptions, maxAge: number, timestampsToReturn?: TimestampsToReturn): DataValue;
    private __findNode;
    writeNode(context: ISessionContext, writeValue: WriteValue): Promise<StatusCode>;
    callMethod(context: ISessionContext, methodToCall: CallMethodRequest): Promise<CallMethodResultOptions>;
    historyReadNode(context: ISessionContext, nodeToRead: HistoryReadValueId, historyReadDetails: HistoryReadDetails, timestampsToReturn: TimestampsToReturn, continuationData: ContinuationData): Promise<HistoryReadResult>;
}
export {};
//# sourceMappingURL=addressSpace_accessor.d.ts.map