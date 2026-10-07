import chalk from "chalk";
import {
    type AddressSpace,
    type CompactAddressSpace,
    callMethodHelper,
    ensureDatatypeExtracted,
    mayHoldOpaqueStructure,
    resolveOpaqueOnAddressSpace,
    SessionContext
} from "node-opcua-address-space";
import type { BaseNode, ContinuationData, ISessionContext, UAVariable } from "node-opcua-address-space-base";
import assert from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { apply_timestamps_no_copy, coerceTimestampsToReturn, DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock, isMinDate } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    AggregateConfiguration,
    BrowseDescription,
    type BrowseDescriptionOptions,
    type BrowseResult,
    type CallMethodRequest,
    type CallMethodResultOptions,
    HistoryReadDetails,
    HistoryReadRequest,
    HistoryReadResult,
    type HistoryReadValueId,
    ReadProcessedDetails,
    type ReadRequestOptions,
    type ReadValueIdOptions,
    type WriteValue
} from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { type ICompactBackend, LocalCompactBackend } from "./compact_backend.js";
import type { IAddressSpaceAccessor } from "./i_address_space_accessor.js";

/** Part 4 5.10.2: a MaxAge of Int32 max or more asks for the cached value as is */
const MAX_AGE_CACHED = 0x7fffffff;

const doDebug = checkDebugFlag("addressSpace_accessor");
const debugLog = make_debugLog("addressSpace_accessor");

function checkReadProcessedDetails(historyReadDetails: ReadProcessedDetails): StatusCode {
    if (!historyReadDetails.aggregateConfiguration) {
        historyReadDetails.aggregateConfiguration = new AggregateConfiguration({
            useServerCapabilitiesDefaults: true
        });
    }
    if (historyReadDetails.aggregateConfiguration.useServerCapabilitiesDefaults) {
        return StatusCodes.Good;
    }

    // The PercentDataGood and PercentDataBad shall follow the following relationship
    //          PercentDataGood ≥ (100 – PercentDataBad).
    // If they are equal the result of the PercentDataGood calculation is used.
    // If the values entered for PercentDataGood and PercentDataBad do not result in a valid calculation
    //  (e.g. Bad = 80; Good = 0) the result will have a StatusCode of Bad_AggregateInvalidInputs.
    if (
        historyReadDetails.aggregateConfiguration.percentDataGood <
        100 - historyReadDetails.aggregateConfiguration.percentDataBad
    ) {
        return StatusCodes.BadAggregateInvalidInputs;
    }
    // The StatusCode Bad_AggregateInvalidInputs will be returned if the value of PercentDataGood
    // or PercentDataBad exceed 100.
    if (
        historyReadDetails.aggregateConfiguration.percentDataGood > 100 ||
        historyReadDetails.aggregateConfiguration.percentDataGood < 0
    ) {
        return StatusCodes.BadAggregateInvalidInputs;
    }
    if (
        historyReadDetails.aggregateConfiguration.percentDataBad > 100 ||
        historyReadDetails.aggregateConfiguration.percentDataBad < 0
    ) {
        return StatusCodes.BadAggregateInvalidInputs;
    }
    return StatusCodes.Good;
}

interface IAddressSpaceAccessorSingle {
    browseNode(browseDescription: BrowseDescriptionOptions, context?: ISessionContext): Promise<BrowseResult>;
    readNode(
        context: ISessionContext,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<DataValue>;
    writeNode(context: ISessionContext, writeValue: WriteValue): Promise<StatusCode>;
    callMethod(context: ISessionContext, methodToCall: CallMethodRequest): Promise<CallMethodResultOptions>;
    historyReadNode(
        context: ISessionContext,
        nodeToRead: HistoryReadValueId,
        historyReadDetails: HistoryReadDetails,
        timestampsToReturn: TimestampsToReturn,
        continuationData: ContinuationData
    ): Promise<HistoryReadResult>;
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

export class AddressSpaceAccessor implements IAddressSpaceAccessor, IAddressSpaceAccessorSingle {
    #compact: CompactNamespaces | null = null;
    #backend: ICompactBackend | null = null;

    constructor(public addressSpace: AddressSpace) {}

    /** the compact space of this thread and the namespaces it serves */
    public set compact(compact: CompactNamespaces | null) {
        this.#compact = compact;
        this.#backend = compact ? new LocalCompactBackend(compact.space, compact.namespaces) : null;
    }
    public get compact(): CompactNamespaces | null {
        return this.#compact;
    }

    /**
     * what serves the compact namespaces: the compact space of this thread (see compact), or the
     * engine thread's store as a front thread sees it
     */
    public set compactBackend(backend: ICompactBackend | null) {
        this.#compact = null;
        this.#backend = backend;
    }
    public get compactBackend(): ICompactBackend | null {
        return this.#backend;
    }

    #isCompact(nodeId: NodeId): boolean {
        return this.#backend?.namespaces.has(nodeId.namespace) ?? false;
    }

    public async browse(context: ISessionContext, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]> {
        const results: BrowseResult[] = [];
        for (const browseDescription of nodesToBrowse) {
            results.push(await this.browseNode(browseDescription, context));
            assert(browseDescription.nodeId, "expecting a nodeId");
        }
        return results;
    }

    public async read(context: ISessionContext, readRequest: ReadRequestOptions): Promise<DataValue[]> {
        /**
         *
         *
         *    @param {number} maxAge: Maximum age of the value to be read in milliseconds.
         *
         *    The age of the value is based on the difference between
         *    the ServerTimestamp and the time when the  Server starts processing the request. For example if the Client
         *    specifies a maxAge of 500 milliseconds and it takes 100 milliseconds until the Server starts  processing
         *    the request, the age of the returned value could be 600 milliseconds  prior to the time it was requested.
         *    If the Server has one or more values of an Attribute that are within the maximum age, it can return any one
         *    of the values or it can read a new value from the data  source. The number of values of an Attribute that
         *    a Server has depends on the  number of MonitoredItems that are defined for the Attribute. In any case,
         *    the Client can make no assumption about which copy of the data will be returned.
         *    If the Server does not have a value that is within the maximum age, it shall attempt to read a new value
         *    from the data source.
         *    If the Server cannot meet the requested maxAge, it returns its 'best effort' value rather than rejecting the
         *    request.
         *    This may occur when the time it takes the Server to process and return the new data value after it has been
         *    accessed is greater than the specified maximum age.
         *    If maxAge is set to 0, the Server shall attempt to read a new value from the data source.
         *    If maxAge is set to the max Int32 value or greater, the Server shall attempt to get a cached value.
         *    Negative values are invalid for maxAge.
         */

        return this.readSync(context, readRequest);
    }

    /**
     * read, without a promise: nothing in a Read is asynchronous once the Variables that need
     * it have been refreshed (see ServerEngine#refreshValues), and the Read service is the
     * busiest one a server answers.
     */
    public readSync(context: ISessionContext, readRequest: ReadRequestOptions): DataValue[] {
        const maxAge = readRequest.maxAge || 0;
        readRequest.maxAge = maxAge;
        const timestampsToReturn = readRequest.timestampsToReturn;
        const nodesToRead = readRequest.nodesToRead || [];

        context.currentTime = getCurrentClock();
        const readAll = () => {
            const dataValues: DataValue[] = new Array(nodesToRead.length);
            for (let i = 0; i < nodesToRead.length; i++) {
                dataValues[i] = this.readNodeSync(context, nodesToRead[i], maxAge, timestampsToReturn);
            }
            return dataValues;
        };
        // the Roles and the namespace defaults are the same for every node of the request
        return context.withPermissionCache ? context.withPermissionCache(readAll) : readAll();
    }

    public async write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        context.currentTime = getCurrentClock();
        await ensureDatatypeExtracted(this.addressSpace);
        const results: StatusCode[] = new Array(nodesToWrite.length);
        // the items of the compact namespaces go to their backend together, in their order
        const backend = this.#backend;
        const compactIndexes: number[] = [];
        if (backend) {
            for (let k = 0; k < nodesToWrite.length; k++) {
                if (this.#isCompact(nodesToWrite[k].nodeId)) compactIndexes.push(k);
            }
        }
        const compactStatuses =
            backend && compactIndexes.length > 0
                ? backend.write(
                      context,
                      // all of them: the array itself, whose bytes as they arrived the backend may use
                      compactIndexes.length === nodesToWrite.length ? nodesToWrite : compactIndexes.map((k) => nodesToWrite[k])
                  )
                : null;
        const compactItem = compactIndexes.length > 0 ? new Set(compactIndexes) : null;
        // the other nodes are written in order, each one once the previous one is done, as before; but
        // a write that is done when writeAttribute returns, the common case, is not awaited
        let i = 0;
        const writeWhileSynchronous = (): Promise<StatusCode> | null => {
            for (; i < nodesToWrite.length; i++) {
                if (compactItem?.has(i)) continue;
                const statusCode = this.#writeNode(context, nodesToWrite[i]);
                if (statusCode instanceof Promise) {
                    return statusCode;
                }
                results[i] = statusCode; // check-proto-pollution: ok - numeric index into an array
            }
            return null;
        };
        while (i < nodesToWrite.length) {
            // the permission cache only lives through a synchronous run: it is dropped before an await
            const pending = context.withPermissionCache
                ? context.withPermissionCache(writeWhileSynchronous)
                : writeWhileSynchronous();
            if (pending) {
                results[i] = await pending; // check-proto-pollution: ok - numeric index into an array
                i++;
            }
        }
        if (compactStatuses) {
            const statuses = await compactStatuses;
            for (let k = 0; k < compactIndexes.length; k++) {
                results[compactIndexes[k]] = statuses[k]; // check-proto-pollution: ok - numeric index of the request
            }
        }
        return results;
    }

    public async call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]> {
        const results: CallMethodResultOptions[] = [];
        await ensureDatatypeExtracted(this.addressSpace);
        for (const methodToCall of methodsToCall) {
            const result = await this.callMethod(context, methodToCall);
            results.push(result);
        }
        return results;
    }
    public async historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]> {
        assert(context instanceof SessionContext);
        assert(historyReadRequest instanceof HistoryReadRequest);

        const timestampsToReturn = historyReadRequest.timestampsToReturn;
        const historyReadDetails = historyReadRequest.historyReadDetails as HistoryReadDetails;
        const releaseContinuationPoints = historyReadRequest.releaseContinuationPoints;
        assert(historyReadDetails instanceof HistoryReadDetails);
        //  ReadAnnotationDataDetails | ReadAtTimeDetails | ReadEventDetails | ReadProcessedDetails | ReadRawModifiedDetails;

        const nodesToRead = historyReadRequest.nodesToRead || ([] as HistoryReadValueId[]);
        assert(Array.isArray(nodesToRead));

        // special cases with ReadProcessedDetails
        interface M {
            nodeToRead: HistoryReadValueId;
            processDetail: ReadProcessedDetails;
            index: number;
        }

        const _q = async (m: M): Promise<HistoryReadResult> => {
            const continuationPoint = m.nodeToRead.continuationPoint;
            return await this.historyReadNode(context, m.nodeToRead, m.processDetail, timestampsToReturn, {
                continuationPoint,
                releaseContinuationPoints
            });
        };

        if (historyReadDetails instanceof ReadProcessedDetails) {
            //
            if (!historyReadDetails.aggregateType || historyReadDetails.aggregateType.length !== nodesToRead.length) {
                return [new HistoryReadResult({ statusCode: StatusCodes.BadInvalidArgument })];
            }

            const parameterStatus = checkReadProcessedDetails(historyReadDetails);
            if (parameterStatus !== StatusCodes.Good) {
                return [new HistoryReadResult({ statusCode: parameterStatus })];
            }
            const promises: Promise<HistoryReadResult>[] = [];
            let index = 0;
            for (const nodeToRead of nodesToRead) {
                const aggregateType = historyReadDetails.aggregateType[index];
                const processDetail = new ReadProcessedDetails({ ...historyReadDetails, aggregateType: [aggregateType] });
                promises.push(_q({ nodeToRead, processDetail, index }));
                index++;
            }

            const results: HistoryReadResult[] = await Promise.all(promises);
            return results;
        }

        const _r = async (nodeToRead: HistoryReadValueId, _index: number) => {
            const continuationPoint = nodeToRead.continuationPoint;
            return await this.historyReadNode(context, nodeToRead, historyReadDetails, timestampsToReturn, {
                continuationPoint,
                releaseContinuationPoints
            });
        };
        const promises: Promise<HistoryReadResult>[] = [];
        let index = 0;
        for (const nodeToRead of nodesToRead) {
            promises.push(_r(nodeToRead, index));
            index++;
        }
        const result = await Promise.all(promises);
        return result;
    }

    public async browseNode(browseDescription: BrowseDescriptionOptions, context?: ISessionContext): Promise<BrowseResult> {
        if (!this.addressSpace) {
            throw new Error("Address Space has not been initialized");
        }
        if (!browseDescription.nodeId) {
            throw new Error("browseNode: expecting a nodeId in browseDescription");
        }
        const nodeId = resolveNodeId(browseDescription.nodeId);
        const description =
            browseDescription instanceof BrowseDescription
                ? browseDescription
                : new BrowseDescription({ ...browseDescription, nodeId });
        const backend = this.#backend;
        if (backend && this.#isCompact(nodeId)) {
            return backend.browse(context ?? null, description);
        }
        const r = this.addressSpace.browseSingleNode(nodeId, description, context);
        if (backend && r.statusCode.isGood()) {
            // the references the compact namespaces add to this node: those that lead into them
            const extra = await backend.references(context ?? null, nodeId, description);
            if (extra.length > 0) {
                r.references = [...(r.references ?? []), ...extra];
            }
        }
        return r;
    }
    public async readNode(
        context: ISessionContext,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<DataValue> {
        return this.readNodeSync(context, nodeToRead, maxAge, timestampsToReturn);
    }

    public readNodeSync(
        context: ISessionContext,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        if (!nodeToRead.nodeId) {
            throw new Error("readNode: expecting a nodeId in nodeToRead");
        }
        if (nodeToRead.attributeId === undefined) {
            throw new Error("readNode: expecting an attributeId in nodeToRead");
        }
        const nodeId = resolveNodeId(nodeToRead.nodeId);
        const attributeId: AttributeIds = nodeToRead.attributeId;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }

        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);

        if (this.#backend && this.#isCompact(nodeId)) {
            return this.#backend.read(context, nodeToRead, maxAge, timestampsToReturn);
        }

        const obj = this.__findNode(nodeId);

        let dataValue: DataValue;
        if (!obj) {
            // Object Not Found
            return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
        } else {
            // check access
            //    BadUserAccessDenied
            //    BadNotReadable
            //    invalid attributes : BadNodeAttributesInvalid
            //    invalid range      : BadIndexRangeInvalid
            dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            dataValue = apply_timestamps_no_copy(dataValue, timestampsToReturn, attributeId);

            if (timestampsToReturn === TimestampsToReturn.Server) {
                dataValue.sourceTimestamp = null;
                dataValue.sourcePicoseconds = 0;
            }
            if (timestampsToReturn === TimestampsToReturn.Both || timestampsToReturn === TimestampsToReturn.Server) {
                const now = context.currentTime || getCurrentClock();
                if (!dataValue.serverTimestamp || isMinDate(dataValue.serverTimestamp)) {
                    dataValue.serverTimestamp = now.timestamp;
                    dataValue.serverPicoseconds = 0; // context.currentTime.picoseconds;
                } else if (maxAge < MAX_AGE_CACHED && now.timestamp.getTime() - dataValue.serverTimestamp.getTime() > maxAge) {
                    // Part 4 5.10.2: with a MaxAge the client wants a value no older than that;
                    // a value without a data source is re-verified from the cache at read
                    // time, and ServerTimestamp is the time the server (re)obtained it
                    // (CTT Attribute Read 006, 018, 023).
                    dataValue.serverTimestamp = now.timestamp;
                    dataValue.serverPicoseconds = now.picoseconds;
                    // the cache moves with it, so that a later read within MaxAge never
                    // reports an older ServerTimestamp than this one
                    const cached =
                        attributeId === AttributeIds.Value ? (obj as unknown as { $dataValue?: DataValue }).$dataValue : undefined;
                    if (cached?.statusCode.isGoodish()) {
                        cached.serverTimestamp = now.timestamp;
                        cached.serverPicoseconds = now.picoseconds;
                    }
                }
            }

            return dataValue;
        }
    }

    private __findNode(nodeId: NodeId): BaseNode | null {
        const namespaceIndex = nodeId.namespace || 0;

        if (!this.addressSpace) {
            return null;
        }
        if (namespaceIndex && namespaceIndex >= this.addressSpace.getNamespaceArray().length) {
            return null;
        }
        const namespace = this.addressSpace.getNamespace(namespaceIndex);
        return namespace.findNode2(nodeId);
    }

    public async writeNode(context: ISessionContext, writeValue: WriteValue): Promise<StatusCode> {
        return await this.#writeNode(context, writeValue);
    }

    /**
     * writes one node: the StatusCode when the write is done on return, which is the common case,
     * a promise of it otherwise (an opaque structure to resolve first, or a setter that answers later)
     */
    #writeNode(context: ISessionContext, writeValue: WriteValue): StatusCode | Promise<StatusCode> {
        const variant = writeValue.value.value;
        if (mayHoldOpaqueStructure(variant)) {
            return resolveOpaqueOnAddressSpace(this.addressSpace, variant).then(() => this.#writeResolvedNode(context, writeValue));
        }
        return this.#writeResolvedNode(context, writeValue);
    }

    #writeResolvedNode(context: ISessionContext, writeValue: WriteValue): StatusCode | Promise<StatusCode> {
        assert(context instanceof SessionContext);
        assert(writeValue.schema.name === "WriteValue");
        assert(writeValue.value instanceof DataValue);

        if (!writeValue.value.value) {
            /* missing Variant */
            return StatusCodes.BadTypeMismatch;
        }

        assert(writeValue.value.value instanceof Variant);

        const nodeId = writeValue.nodeId;

        if (this.#backend && this.#isCompact(nodeId)) {
            return this.#backend.write(context, [writeValue]).then((statuses) => statuses[0]);
        }

        const obj = this.__findNode(nodeId) as UAVariable;
        if (!obj) {
            return StatusCodes.BadNodeIdUnknown;
        }
        // writeAttribute answers through a callback: called before it returns for a plain value or
        // a synchronous setter, later for an asynchronous one
        let answered = false;
        let answerError: Error | null = null;
        let answer: StatusCode = StatusCodes.Good;
        let later: { resolve: (statusCode: StatusCode) => void; reject: (err: Error) => void } | null = null;
        obj.writeAttribute(context, writeValue, (err, statusCode) => {
            // a setter is allowed to invoke its callback with no statusCode to mean Good
            const status = statusCode || StatusCodes.Good;
            if (later) {
                err ? later.reject(err) : later.resolve(status);
                return;
            }
            answered = true;
            answerError = err ?? null;
            answer = status;
        });
        if (answered) {
            if (answerError) {
                throw answerError;
            }
            return answer;
        }
        return new Promise<StatusCode>((resolve, reject) => {
            later = { resolve, reject };
        });
    }

    public async callMethod(context: ISessionContext, methodToCall: CallMethodRequest): Promise<CallMethodResultOptions> {
        return await callMethodHelper(context, this.addressSpace, methodToCall);
    }

    public async historyReadNode(
        context: ISessionContext,
        nodeToRead: HistoryReadValueId,
        historyReadDetails: HistoryReadDetails,
        timestampsToReturn: TimestampsToReturn,
        continuationData: ContinuationData
    ): Promise<HistoryReadResult> {
        assert(context instanceof SessionContext);
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new HistoryReadResult({
                statusCode: StatusCodes.BadTimestampsToReturnInvalid
            });
        }
        const nodeId = nodeToRead.nodeId;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;
        const _continuationPoint = nodeToRead.continuationPoint;

        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new HistoryReadResult({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }

        const obj = this.__findNode(nodeId) as UAVariable;

        if (!obj) {
            // may be return BadNodeIdUnknown in dataValue instead ?
            // Object Not Found
            return new HistoryReadResult({ statusCode: StatusCodes.BadNodeIdUnknown });
        } else {
            /* c8 ignore next */
            if (!obj.historyRead) {
                // note : Object and View may also support historyRead to provide Event historical data
                //        todo implement historyRead for Object and View
                const msg =
                    " this node doesn't provide historyRead! probably not a UAVariable\n " +
                    obj.nodeId.toString() +
                    " " +
                    obj.browseName.toString() +
                    "\n" +
                    "with " +
                    nodeToRead.toString() +
                    "\n" +
                    "HistoryReadDetails " +
                    historyReadDetails.toString();
                /* c8 ignore next */
                if (doDebug) {
                    debugLog(chalk.cyan("ServerEngine#_historyReadNode "), chalk.white.bold(msg));
                }
                throw new Error(msg);
            }
            // check access
            //    BadUserAccessDenied
            //    BadNotReadable
            //    invalid attributes : BadNodeAttributesInvalid
            //    invalid range      : BadIndexRangeInvalid
            const result = await obj.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationData);

            assert(result?.isValid());
            return result;
        }
    }
}
