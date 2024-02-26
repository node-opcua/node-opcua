import chalk from "chalk";
import {
    AddressSpace,
    ensureDatatypeExtracted,
    SessionContext,
    resolveOpaqueOnAddressSpace,
    callMethodHelper
} from "node-opcua-address-space";
import { ISessionContext, ContinuationData, BaseNode, UAVariable } from "node-opcua-address-space-base";
import assert from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { TimestampsToReturn, DataValue, coerceTimestampsToReturn, apply_timestamps_no_copy } from "node-opcua-data-value";
import { getCurrentClock, minOPCUADate } from "node-opcua-date-time";
import { resolveNodeId, coerceNodeId, NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { doDebug, debugLog } from "node-opcua-pki";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    BrowseDescriptionOptions,
    BrowseResult,
    ReadValueIdOptions,
    WriteValue,
    CallMethodRequest,
    CallMethodResultOptions,
    HistoryReadValueId,
    HistoryReadDetails,
    HistoryReadResult,
    ReadRequestOptions,
    HistoryReadRequest,
    ReadProcessedDetails,
    BrowseDescription,
    AggregateConfiguration
} from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { IAddressSpaceAccessor } from "./i_address_space_accessor";

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

export class AddressSpaceAccessor implements IAddressSpaceAccessor, IAddressSpaceAccessorSingle {
    constructor(public addressSpace: AddressSpace) {}

    public async browse(context: ISessionContext, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]> {
        const results: BrowseResult[] = [];
        for (const browseDescription of nodesToBrowse) {
            results.push(await this.browseNode(browseDescription, context));
            assert(browseDescription.nodeId!, "expecting a nodeId");
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

        readRequest.maxAge = readRequest.maxAge || 0;
        const timestampsToReturn = readRequest.timestampsToReturn;
        const nodesToRead = readRequest.nodesToRead || [];

        context.currentTime = getCurrentClock();
        const dataValues: DataValue[] = [];
        for (const readValueId of nodesToRead) {
            const dataValue = await this.readNode(context, readValueId, readRequest.maxAge, timestampsToReturn);
            dataValues.push(dataValue);
        }
        return dataValues;
    }

    public async write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        context.currentTime = getCurrentClock();
        await ensureDatatypeExtracted(this.addressSpace!);
        const results: StatusCode[] = [];
        for (const writeValue of nodesToWrite) {
            const statusCode = await this.writeNode(context, writeValue);
            results.push(statusCode);
        }
        return results;
    }

    public async call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]> {
        const results: CallMethodResultOptions[] = [];
        await ensureDatatypeExtracted(this.addressSpace!);
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
        const historyReadDetails = historyReadRequest.historyReadDetails! as HistoryReadDetails;
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

        const _r = async (nodeToRead: HistoryReadValueId, index: number) => {
            const continuationPoint = nodeToRead.continuationPoint;
            return await this.historyReadNode(context, nodeToRead, historyReadDetails, timestampsToReturn, {
                continuationPoint,
                releaseContinuationPoints,
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
        const nodeId = resolveNodeId(browseDescription.nodeId!);
        const r = this.addressSpace.browseSingleNode(
            nodeId,
            browseDescription instanceof BrowseDescription
                ? browseDescription
                : new BrowseDescription({ ...browseDescription, nodeId }),
            context
        );
        return r;
    }
    public async readNode(
        context: ISessionContext,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<DataValue> {
        assert(context instanceof SessionContext);
        const nodeId = resolveNodeId(nodeToRead.nodeId!);
        const attributeId: AttributeIds = nodeToRead.attributeId!;
        const indexRange: NumericRange = nodeToRead.indexRange!;
        const dataEncoding = nodeToRead.dataEncoding;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }

        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);

        const obj = this.__findNode(coerceNodeId(nodeId));

        let dataValue;
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
            if (
                (timestampsToReturn === TimestampsToReturn.Both || timestampsToReturn === TimestampsToReturn.Server) &&
                (!dataValue.serverTimestamp || dataValue.serverTimestamp.getTime() === minOPCUADate.getTime())
            ) {
                const t: Date = context.currentTime ? context.currentTime.timestamp : getCurrentClock().timestamp;
                dataValue.serverTimestamp = t;
                dataValue.serverPicoseconds = 0; // context.currentTime.picoseconds;
            }

            return dataValue;
        }
    }

    private __findNode(nodeId: NodeId): BaseNode | null {
        const namespaceIndex = nodeId.namespace || 0;

        if (namespaceIndex && namespaceIndex >= (this.addressSpace?.getNamespaceArray().length || 0)) {
            return null;
        }
        const namespace = this.addressSpace!.getNamespace(namespaceIndex)!;
        return namespace.findNode2(nodeId)!;
    }

    public async writeNode(context: ISessionContext, writeValue: WriteValue): Promise<StatusCode> {
        await resolveOpaqueOnAddressSpace(this.addressSpace!, writeValue.value.value!);

        assert(context instanceof SessionContext);
        assert(writeValue.schema.name === "WriteValue");
        assert(writeValue.value instanceof DataValue);

        if (!writeValue.value.value) {
            /* missing Variant */
            return StatusCodes.BadTypeMismatch;
        }

        assert(writeValue.value.value instanceof Variant);

        const nodeId = writeValue.nodeId;

        const obj = this.__findNode(nodeId) as UAVariable;
        if (!obj) {
            return StatusCodes.BadNodeIdUnknown;
        } else {
            return await new Promise<StatusCode>((resolve, reject) => {
                obj.writeAttribute(context, writeValue, (err, statusCode) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(statusCode!);
                    }
                });
            });
        }
    }

    public async callMethod(context: ISessionContext, methodToCall: CallMethodRequest): Promise<CallMethodResultOptions> {
        return await new Promise((resolve, reject) => {
            callMethodHelper(context, this.addressSpace, methodToCall, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result!);
                }
            });
        });
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
        const continuationPoint = nodeToRead.continuationPoint;

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
            // istanbul ignore next
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
                // istanbul ignore next
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
    
            assert(result!.isValid());
            return result;
        }
    }
}
