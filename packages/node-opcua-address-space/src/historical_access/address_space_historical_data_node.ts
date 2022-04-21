/**
 * @module node-opcua-address-space
 * @class IAddressSpace
 */
// tslint:disable:no-console

import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { AccessLevelFlag, NodeClass, QualifiedNameLike } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { isMinDate } from "node-opcua-date-time";
import { UAHistoricalDataConfiguration } from "node-opcua-nodeset-ua";
import { NumericRange } from "node-opcua-numeric-range";
import {
    HistoryData,
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import { CallbackT } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import {
    IAddressSpace,
    IVariableHistorian,
    IVariableHistorianOptions,
    UAVariable,
    ContinuationData
} from "node-opcua-address-space-base";
import { ISessionContext } from "node-opcua-address-space-base";

import { UAVariableImpl } from "../ua_variable_impl";
import { AddressSpace } from "../../source/address_space_ts";
import { AddressSpacePrivate } from "../address_space_private";

// tslint:disable:no-var-requires
const Dequeue = require("dequeue");

/* interface Historian  */
// {
//
// }
function inInTimeRange(historyReadDetails: any, dataValue: DataValue): boolean {
    if (
        historyReadDetails.startTime &&
        !isMinDate(historyReadDetails.startTime) &&
        dataValue.sourceTimestamp! < historyReadDetails.startTime
    ) {
        return false;
    }
    if (
        historyReadDetails.endTime &&
        !isMinDate(historyReadDetails.endTime) &&
        dataValue.sourceTimestamp! > historyReadDetails.endTime
    ) {
        return false;
    }
    return true;
}

function inInTimeRange2(historyReadDetails: any, dataValue: DataValue): boolean {
    if (
        historyReadDetails.endTime &&
        !isMinDate(historyReadDetails.endTime) &&
        dataValue.sourceTimestamp! > historyReadDetails.endTime
    ) {
        return false;
    }
    return !(
        historyReadDetails.startTime &&
        !isMinDate(historyReadDetails.startTime) &&
        dataValue.sourceTimestamp! < historyReadDetails.startTime
    );
}

function filter_dequeue(
    q: any,
    historyReadRawModifiedDetails: ReadRawModifiedDetails,
    onlyThisNumber: number,
    isReversed: boolean
) {
    const r: any[] = [];
    const predicate = isReversed
        ? inInTimeRange2.bind(null, historyReadRawModifiedDetails)
        : inInTimeRange.bind(null, historyReadRawModifiedDetails);

    if (isReversed) {
        let c = q.head.prev;
        while (c.data) {
            if (predicate(c.data)) {
                r.push(c.data);
            }
            c = c.prev;
            if (onlyThisNumber && r.length === onlyThisNumber) {
                return r;
            }
        }
    } else {
        let c = q.head.next;
        while (c.data) {
            if (predicate(c.data)) {
                r.push(c.data);
            }
            c = c.next;
            if (onlyThisNumber && r.length === onlyThisNumber) {
                return r;
            }
        }
    }
    return r;
}

export class VariableHistorian implements IVariableHistorian {
    public readonly node: UAVariable;
    private readonly _timeline: any /* Dequeue */;
    private readonly _maxOnlineValues: number;
    private lastDate: Date;
    private lastDatePicoSeconds: number;

    constructor(node: UAVariable, options: IVariableHistorianOptions) {
        this._timeline = new Dequeue(); // is is ordered here ??????
        this._maxOnlineValues = options.maxOnlineValues || 1000;
        this.lastDate = new Date(1600, 0, 1, 0, 0, 0);
        this.lastDatePicoSeconds = 0;
        this.node = node;
    }

    /* public */
    public push(newDataValue: DataValue): any {
        this._timeline.push(newDataValue);

        const sourceTime = newDataValue.sourceTimestamp || new Date();
        const sourcePicoSeconds = newDataValue.sourcePicoseconds || 0;

        // ensure that values are set with date increasing
        if (sourceTime.getTime() <= this.lastDate.getTime()) {
            if (!(sourceTime.getTime() === this.lastDate.getTime() && sourcePicoSeconds > this.lastDatePicoSeconds)) {
                console.log(
                    chalk.red("Warning date not increasing "),
                    newDataValue.toString(),
                    " last known date = ",
                    this.lastDate
                );
            }
        }

        this.lastDate = sourceTime;
        this.lastDatePicoSeconds = newDataValue.sourcePicoseconds || 0;

        // we keep only a limited amount in main memory
        if (this._timeline.length > this._maxOnlineValues) {
            assert(typeof this._maxOnlineValues === "number" && this._maxOnlineValues > 0);
            while (this._timeline.length > this._maxOnlineValues) {
                this._timeline.shift();
            }
        }

        if (this._timeline.length >= this._maxOnlineValues || this._timeline.length === 1) {
            const first = this._timeline.first();
            (this.node as UAVariableImpl)._update_startOfOnlineArchive(first.sourceTimestamp);
            // we update the node startOnlineDate
        }
    }

    public extractDataValues(
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        reverseDataValue: boolean,
        callback: CallbackT<DataValue[]>
    ): void {
        assert(typeof callback === 'function');

        let dataValues = filter_dequeue(this._timeline, historyReadRawModifiedDetails, maxNumberToExtract, isReversed);

        if (reverseDataValue) {
            dataValues = dataValues.reverse();
        }
        callback(null, dataValues);
    }
}

function _get_startOfOfflineArchive(node: UAVariableImpl) {
    if (!node.$historicalDataConfiguration) {
        throw new Error("this variable has no HistoricalDataConfiguration");
    }
    return node.$historicalDataConfiguration.startOfArchive?.readValue();
}

function _get_startOfArchive(node: UAVariableImpl) {
    if (!node.$historicalDataConfiguration) {
        throw new Error("this variable has no HistoricalDataConfiguration");
    }
    return node.$historicalDataConfiguration!.startOfArchive?.readValue();
}

function _update_startOfArchive(this: UAVariableImpl, newDate: Date): void {
    if (!this.$historicalDataConfiguration) {
        throw new Error("this variable has no HistoricalDataConfiguration");
    }
    this.$historicalDataConfiguration.startOfArchive?.setValueFromSource({
        dataType: DataType.DateTime,
        value: newDate
    });
}

function _update_startOfOnlineArchive(this: UAVariableImpl, newDate: Date): void {
    if (!this.$historicalDataConfiguration) {
        throw new Error("this variable has no HistoricalDataConfiguration");
    }

    // The StartOfArchive Variable specifies the date before which there is no data
    // in the archive either online or offline.
    // The StartOfOnlineArchive Variable specifies the date of the earliest data
    // in the online archive.
    this.$historicalDataConfiguration.startOfOnlineArchive?.setValueFromSource({
        dataType: DataType.DateTime,
        value: newDate
    });

    const startOfArchiveDataValue = _get_startOfOfflineArchive(this);
    if (
        startOfArchiveDataValue &&
        (startOfArchiveDataValue.statusCode !== StatusCodes.Good ||
            !startOfArchiveDataValue.value ||
            !startOfArchiveDataValue.value.value ||
            startOfArchiveDataValue.value.value.getTime() >= newDate.getTime())
    ) {
        this._update_startOfArchive(newDate);
    }
}

UAVariableImpl.prototype._update_startOfOnlineArchive = _update_startOfOnlineArchive;
UAVariableImpl.prototype._update_startOfArchive = _update_startOfArchive;

function _historyPush(this: UAVariableImpl, newDataValue: DataValue) {
    if (!this.varHistorian) {
        throw new Error("this variable has no HistoricalDataConfiguration");
    }
    assert(Object.prototype.hasOwnProperty.call(this, "historizing"), "expecting a historizing attribute on node");
    if (!this.historizing) {
        return; //
    }
    assert(this.historizing === true);
    this.varHistorian.push(newDataValue);
}

function _historyReadModify(
    this: UAVariable,
    context: ISessionContext,
    historyReadRawModifiedDetails: ReadRawModifiedDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) {
    //
    // 6.4.3.3 Read modified functionality
    // Release 1.03 26 OPC Unified Architecture, Part 11
    //
    // When this structure is used for reading Modified Values (isReadModified is set to TRUE), it
    // reads the modified values, StatusCodes, timestamps, modification type, the user identifier,
    // and the timestamp of the modification from the history database for the specified time domain
    // for one or more HistoricalDataNodes. If there are multiple replaced values the Server shall
    // return all of them. The updateType specifies what value is returned in the modification record.
    // If the updateType is INSERT the value is the new value that was inserted. If the updateType
    // is anything else the value is the old value that was changed. See 6.8 HistoryUpdateDetails
    // parameter for details on what updateTypes are available.
    // The purpose of this function is to read values from history that have been Modified. The
    // returnBounds parameter shall be set to FALSE for this case, otherwise the Server returns a
    // BadInvalidArgument StatusCode.
    // The domain of the request is defined by startTime, endTime, and numValuesPerNode; at least
    // two of these shall be specified. If endTime is less than startTime, or endTime and
    // numValuesPerNode alone are specified, then the data shall be returned in reverse order with
    // the later data coming first. If all three are specified then the call shall return up to
    // numValuesPerNode results going from StartTime to EndTime, in either ascending or
    // descending order depending on the relative values of StartTime and EndTime. If more than
    // numValuesPerNode values exist within that time range for a given Node then only
    // numValuesPerNode values per Node are returned along with a continuationPoint. When a
    // continuationPoint is returned, a Client wanting the next numValuesPerNode values should call
    // ReadRaw again with the continuationPoint set. If numValuesPerNode is 0 then all of the
    // values in the range are returned. If the Server cannot return all modified values for a given
    // timestamp in a single response then it shall return modified values with the same timestamp
    // in subsequent calls.
    // If the request takes a long time to process then the Server can return partial results with a
    // ContinuationPoint. This might be done if the request is going to take more time than the Client
    // timeout hint. It may take longer than the Client timeout hint to retrieve any results. In this case
    // the Server may return zero results with a ContinuationPoint that allows the Server to resume
    // the calculation on the next Client HistoryRead call.
    // If a value has been modified multiple times then all values for the time are returned. This
    // means that a timestamp can appear in the array more than once. The order of the returned
    // values with the same timestamp should be from the most recent to oldest modification
    // timestamp, if startTime is less than or equal to endTime. If endTime is less than startTime,
    // then the order of the returned values will be from the oldest modification timestamp to the
    // most recent. It is Server dependent whether multiple modifications are kept or only the most
    // recent.
    // A Server does not have to create a modification record for data when it is first added to the
    // historical collection. If it does then it shall set the ExtraData bit and the Client can read the
    // modification record using a ReadModified call. If the data is subsequently modified the Server
    // shall create a second modification record which is returned along with the original
    // modification record whenever a Client uses the ReadModified call if the Server supports
    // multiple modification records per timestamp.
    // If the requested TimestampsToReturn is not supported for a Node then the operation shall
    // return the BadTimestampNotSupported StatusCode.

    // todo : provide correct implementation
    const result = new HistoryReadResult({
        historyData: new HistoryData({ dataValues: [] }),
        statusCode: StatusCodes.BadUnexpectedError
    });
    return callback(null, result);
}

function _historyReadRawAsync(
    this: UAVariableImpl,
    historyReadRawModifiedDetails: ReadRawModifiedDetails,
    maxNumberToExtract: number,
    isReversed: boolean,
    reverseDataValue: boolean,
    callback: CallbackT<DataValue[]>
) {
    assert(typeof callback === 'function');
    this.varHistorian!.extractDataValues(historyReadRawModifiedDetails, maxNumberToExtract, isReversed, reverseDataValue, callback);
}

function _historyReadRaw(
    this: UAVariable,
    context: ISessionContext,
    historyReadRawModifiedDetails: ReadRawModifiedDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
): void {
    assert(historyReadRawModifiedDetails instanceof ReadRawModifiedDetails);

    // 6.4.3.2 Read raw functionality
    //
    // When this structure is used for reading Raw Values (isReadModified is set to FALSE), it reads
    // the values, qualities, and timestamps from the history database for the specified time domain
    // for one or more HistoricalDataNodes.
    //
    // This parameter is intended for use by a Client that wants the actual data saved within the historian.
    //
    // The actual data may be compressed or may be all raw data collected for the item depending on the
    // historian and the storage rules invoked when the item values were saved.
    //
    // When returnBounds is TRUE, the Bounding Values for the time domain are returned. The optional Bounding
    // Values are provided to allow the Client to interpolate values for the start and end times when trending
    // the actual data on a display.
    //
    // The time domain of the request is defined by startTime, endTime, and numValuesPerNode;
    // at least two of these shall be specified.
    //
    // If endTime is less than startTime, or endTime and numValuesPerNode alone are specified
    // then the data will be returned in reverse order, with later data coming first as if time
    // were flowing backward.
    //
    // If all three are specified then the call shall return up to numValuesPerNode results going from
    // startTime to endTime, in either ascending or descending order depending on the relative values
    // of startTime and endTime.
    //
    // If numValuesPerNode is 0, then all the values in the range are returned.
    //
    // A default value of DateTime.MinValue (see Part 6) is used to indicate when startTime or
    // endTime is not specified.
    //
    // It is specifically allowed for the startTime and the endTime to be identical.
    // This allows the Client to request just one value.
    // When the startTime and endTime are identical then time is presumed to be flowing forward.
    // It is specifically not allowed for the Server to return a Bad_InvalidArgument StatusCode
    // if the requested time domain is outside of the Server's range. Such a case shall be treated
    // as an interval in which no data exists.
    //
    // If a startTime, endTime and numValuesPerNode are all provided and if more than
    // numValuesPerNode values exist within that time range for a given Node then only
    // numValuesPerNode values per Node are returned along with a continuationPoint.
    //
    // When a continuationPoint is returned, a Client wanting the next numValuesPerNode values
    // should call ReadRaw again with the continuationPoint set.
    //
    // If the request takes a long time to process then the Server can return partial results with a
    // ContinuationPoint. This might be done if the request is going to take more time than the Client
    // timeout hint. It may take longer than the Client timeout hint to retrieve any results.
    // In this case the Server may return zero results with a ContinuationPoint that allows the
    // Server to resume the calculation on the next Client HistoryRead call.
    //
    // If Bounding Values are requested and a non-zero numValuesPerNode was specified then any
    // Bounding Values returned are included in the numValuesPerNode count.
    //
    // If numValuesPerNode is 1 then only the start bound is returned (the end bound if the reverse
    // order is needed).
    //
    // If numValuesPerNode is 2 then the start bound and the first data point are
    // returned (the end bound if reverse order is needed).
    //
    // When Bounding Values are requested and no bounding value is found then the corresponding
    // StatusCode entry will be set to Bad_BoundNotFound, a timestamp equal to the start or end time
    // as appropriate, and a value of null.
    // How far back or forward to look in history for Bounding Values is Server dependent.
    //
    // For an interval in which no data exists, if Bounding Values are not requested, then the
    // corresponding StatusCode shall be Good_NoData. If Bounding Values are requested and one
    // or both exist, then the result code returned is Success and the bounding value(s) are
    // returned.
    //
    // For cases where there are multiple values for a given timestamp, all but the most recent are
    // considered to be Modified values and the Server shall return the most recent value. If the
    // Server returns a value which hides other values at a timestamp then it shall set the ExtraData
    // bit in the StatusCode associated with that value. If the Server contains additional information
    // regarding a value then the ExtraData bit shall also be set. It indicates that ModifiedValues are
    // available for retrieval, see 6.4.3.3.
    //
    // If the requested TimestampsToReturn is not supported for a Node, the operation shall return
    // the Bad_TimestampNotSupported StatusCode.

    const session = context.session;
    if (!session) {
        throw new Error("Internal Error: context.session not defined");
    }
    if (continuationData.continuationPoint) {
        const cnt = session.continuationPointManager.getNextHistoryReadRaw(
            historyReadRawModifiedDetails.numValuesPerNode,
            continuationData
        );
        const { statusCode, values } = cnt;
        const result2 = new HistoryReadResult({
            continuationPoint: cnt.continuationPoint,
            historyData: new HistoryData({ dataValues: values }),
            statusCode
        });
        return callback(null, result2);
    }

    // todo add special treatment for when startTime > endTime
    // ( in this case series must be return in reverse order )

    let maxNumberToExtract = 0;
    let isReversed = false;
    let reverseDataValue = false;
    if (isMinDate(historyReadRawModifiedDetails.endTime!)) {
        // end time is not specified
        maxNumberToExtract = historyReadRawModifiedDetails.numValuesPerNode;
        if (isMinDate(historyReadRawModifiedDetails.startTime!)) {
            // end start and start time are not specified, this is invalid
            const result = new HistoryReadResult({
                statusCode: StatusCodes.BadHistoryOperationUnsupported // should be an error
            });
            return callback(null, result);
        }
    } else if (isMinDate(historyReadRawModifiedDetails.startTime!)) {
        // start time is not specified
        // end time is specified
        maxNumberToExtract = historyReadRawModifiedDetails.numValuesPerNode;
        isReversed = true;
        reverseDataValue = false;

        if (historyReadRawModifiedDetails.numValuesPerNode === 0) {
            // when start time is not specified
            // and end time is specified
            // numValuesPerNode shall be greater than 0
            const result = new HistoryReadResult({
                statusCode: StatusCodes.BadHistoryOperationUnsupported // should be an error
            });
            return callback(null, result);
        }
    } else {
        // start time is specified
        // end time is specified
        if (historyReadRawModifiedDetails.endTime!.getTime() < historyReadRawModifiedDetails.startTime!.getTime()) {
            reverseDataValue = true;
            const tmp = historyReadRawModifiedDetails.endTime;
            historyReadRawModifiedDetails.endTime = historyReadRawModifiedDetails.startTime;
            historyReadRawModifiedDetails.startTime = tmp;
        }
    }

    /*
    const maxHistoryContinuationPoints = this.engine.serverCapabilities.maxHistoryContinuationPoints;
    if (session.continuationPointManager.hasReachedMaximum(maxHistoryContinuationPoints)) {
        return new HistoryReadResult({ statusCode: StatusCodes.BadNoContinuationPoints });
    }
    */

    (this as UAVariableImpl)._historyReadRawAsync(
        historyReadRawModifiedDetails,
        maxNumberToExtract,
        isReversed,
        reverseDataValue,
        (err: Error | null, dataValues?: DataValue[]) => {
            if (err || !dataValues) {
                return callback(err);
            }

            const cnt = session.continuationPointManager.registerHistoryReadRaw(
                historyReadRawModifiedDetails.numValuesPerNode,
                dataValues,
                continuationData
            );
            const result = new HistoryReadResult({
                continuationPoint: cnt.continuationPoint,
                historyData: new HistoryData({ dataValues: cnt.values }),
                statusCode: cnt.statusCode
            });
            callback(null, result);
        }
    );
}

function _historyReadRawModify(
    this: UAVariable,
    context: ISessionContext,
    historyReadRawModifiedDetails: ReadRawModifiedDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) {
    const node = this as UAVariableImpl;

    assert(historyReadRawModifiedDetails instanceof ReadRawModifiedDetails);

    if (!historyReadRawModifiedDetails.isReadModified) {
        return node._historyReadRaw(context, historyReadRawModifiedDetails, indexRange, dataEncoding, continuationData, callback);
    } else {
        return node._historyReadModify(
            context,
            historyReadRawModifiedDetails,
            indexRange,
            dataEncoding,
            continuationData,
            callback
        );
    }
}

function _historyRead(
    this: UAVariableImpl,
    context: ISessionContext,
    historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) {
    assert(typeof callback === 'function');
    if (historyReadDetails instanceof ReadRawModifiedDetails) {
        // note: only ReadRawModifiedDetails supported at this time
        return this._historyReadRawModify(context, historyReadDetails, indexRange, dataEncoding, continuationData, callback);
    } else if (historyReadDetails instanceof ReadEventDetails) {
        // The ReadEventDetails structure is used to read the Events from the history database for the
        // specified time domain for one or more HistoricalEventNodes. The Events are filtered based on
        // the filter structure provided. This filter includes the EventFields that are to be returned. For a
        // complete description of filter refer to Part 4.
        // The startTime and endTime are used to filter on the Time field for Events.
        // The time domain of the request is defined by startTime, endTime, and numValuesPerNode; at
        // least two of these shall be specified. If endTime is less than startTime, or endTime and
        // numValuesPerNode alone are specified then the data will be returned in reverse order with
        // later/newer data provided first as if time were flowing backward. If all three are specified then
        // the call shall return up to numValuesPerNode results going from startTime to endTime, in
        // either ascending or descending order depending on the relative values of startTime and
        // endTime. If numValuesPerNode is 0 then all of the values in the range are returned. The
        // default value is used to indicate when startTime, endTime or numValuesPerNode are not
        // specified.
        // It is specifically allowed for the startTime and the endTime to be identical. This allows the
        // Client to request the Event at a single instance in time. When the startTime and endTime are
        // identical then time is presumed to be flowing forward. If no data exists at the time specified
        // then the Server shall return the Good_NoData StatusCode.
        // If a startTime, endTime and numValuesPerNode are all provided, and if more than
        // numValuesPerNode Events exist within that time range for a given Node, then only
        // numValuesPerNode Events per Node are returned along with a ContinuationPoint. When a
        // ContinuationPoint is returned, a Client wanting the next numValuesPerNode values should
        // call HistoryRead again with the continuationPoint set.
        // If the request takes a long time to process then the Server can return partial results with a
        // ContinuationPoint. This might be done if the request is going to take more time than the Client
        // timeout hint. It may take longer than the Client timeout hint to retrieve any results. In this case
        // the Server may return zero results with a ContinuationPoint that allows the Server to resume
        // the calculation on the next Client HistoryRead call.
        // For an interval in which no data exists, the corresponding StatusCode shall be Good_NoData.
        // The filter parameter is used to determine which historical Events and their corresponding
        // fields are returned. It is possible that the fields of an EventType are available for real time
        // updating, but not available from the historian. In this case a StatusCode value will be returned
        // for any Event field that cannot be returned. The value of the StatusCode shall be
        // Bad_NoData.
        // If the requested TimestampsToReturn is not supported for a Node then the operation shall
        // return the Bad_TimestampNotSupported StatusCode. When reading Events this only applies
        // to Event fields that are of type DataValue.

        // todo provide correct implementation
        const result = new HistoryReadResult({
            historyData: new HistoryData({ dataValues: [] }),
            statusCode: StatusCodes.BadHistoryOperationUnsupported
        });
        return callback(null, result);
    } else if (historyReadDetails instanceof ReadProcessedDetails) {
        const addressSpace = this.addressSpace as AddressSpacePrivate;
        if (!addressSpace._readProcessedDetails) {
            const result = new HistoryReadResult({
                historyData: new HistoryData({}),
                statusCode: StatusCodes.BadHistoryOperationUnsupported
            });
            return callback(null, result);
        } else {
            return addressSpace._readProcessedDetails(
                this,
                context,
                historyReadDetails,
                indexRange,
                dataEncoding,
                continuationData,
                callback
            );
        }
    } else if (historyReadDetails instanceof ReadAtTimeDetails) {
        // Release 1.03 28 OPC Unified Architecture, Part 11
        // The ReadAtTimeDetails structure reads the values and qualities from the history database for
        // the specified timestamps for one or more HistoricalDataNodes. This function is intended to
        // provide values to correlate with other values with a known timestamp. For example, a Client
        // may need to read the values of sensors when lab samples were collected.
        // The order of the values and qualities returned shall match the order of the timestamps
        // supplied in the request.
        // When no value exists for a specified timestamp, a value shall be Interpolated from the
        // surrounding values to represent the value at the specified timestamp. The interpolation will
        // follow the same rules as the standard Interpolated Aggregate as outlined in Part 13.
        // If the useSimpleBounds flag is True and Interpolation is required then simple bounding values
        // will be used to calculate the data value. If useSimpleBounds is False and Interpolation is
        // required then interpolated bounding values will be used to calculate the data value. See
        // Part 13 for the definition of simple bounding values and interpolated bounding values.
        // If a value is found for the specified timestamp, then the Server will set the StatusCode
        // InfoBits to be Raw. If the value is Interpolated from the surrounding values, then the Server
        // will set the StatusCode InfoBits to be Interpolated.
        // If the read request is taking a long time to calculate then the Server may return zero results
        // with a ContinuationPoint that allows the Server to resume the calculation on the next Client
        // HistoryRead call.
        // If the requested TimestampsToReturn is not supported for a Node, then the operation shall
        // return the Bad_TimestampNotSupported StatusCode.

        // todo provide correct implementation
        const result = new HistoryReadResult({
            historyData: new HistoryData({ dataValues: [] }),
            statusCode: StatusCodes.BadHistoryOperationUnsupported
        });
        return callback(null, result);
    } else {
        const result = new HistoryReadResult({
            historyData: new HistoryData({ dataValues: [] }),
            statusCode: StatusCodes.BadHistoryOperationUnsupported
        });
        return callback(null, result);
    }
}

function on_value_change(this: UAVariableImpl, newDataValue: DataValue): void {
    this._historyPush.call(this, newDataValue);
}

/**
 * @method installHistoricalDataNode
 * @param node      UAVariable
 * @param [options] {Object}
 * @param [options.maxOnlineValues = 1000]
 */
export function AddressSpace_installHistoricalDataNode(
    this: IAddressSpace,
    node: UAVariableImpl,
    options?: IVariableHistorianOptions
): void {
    AddressSpace.historizerFactory = AddressSpace.historizerFactory || {
        create(node1: UAVariable, options1: IVariableHistorianOptions) {
            return new VariableHistorian(node1, options1);
        }
    };

    assert(node.nodeClass === NodeClass.Variable);
    options = options || {};

    const addressSpace = node.addressSpace;

    // install specific history behavior
    node._historyRead = _historyRead;
    node._historyPush = _historyPush;

    node._historyReadRawModify = _historyReadRawModify;
    node._historyReadModify = _historyReadModify;
    node._historyReadRaw = _historyReadRaw;
    node._historyReadRawAsync = _historyReadRawAsync;

    node.varHistorian = (options as any).historian || AddressSpace.historizerFactory.create(node, options);

    const historicalDataConfigurationType = addressSpace.findObjectType("HistoricalDataConfigurationType");
    if (!historicalDataConfigurationType) {
        throw new Error("cannot find HistoricalDataConfigurationType");
    }
    node.historizing = true;

    // tslint:disable:no-bitwise
    node.accessLevel = node.accessLevel | AccessLevelFlag.CurrentRead | AccessLevelFlag.HistoryRead;
    if (node.userAccessLevel !== undefined) {
        node.userAccessLevel = node.userAccessLevel | AccessLevelFlag.CurrentRead | AccessLevelFlag.HistoryRead;
    }

    const optionals = ["Stepped", "Definition", "MaxTimeInterval", "MinTimeInterval", "StartOfArchive", "StartOfOnlineArchive"];

    // Note from spec : If a HistoricalDataNode has configuration defined then one
    //                    instance shall have a BrowseName of ‘HA Configuration’
    const historicalDataConfiguration = historicalDataConfigurationType.instantiate({
        browseName: { name: "HA Configuration", namespaceIndex: 0 },
        optionals
    }) as UAHistoricalDataConfiguration;

    // All Historical Configuration Objects shall be referenced using the HasHistoricalConfiguration ReferenceType.
    node.addReference({
        isForward: true,
        nodeId: historicalDataConfiguration.nodeId,
        referenceType: "HasHistoricalConfiguration"
    });

    //  The Stepped Variable specifies whether the historical data was collected in such a manner
    //  that it should be displayed as SlopedInterpolation (sloped line between points) or as
    //  SteppedInterpolation (vertically-connected horizontal lines between points) when raw data is
    //  examined. This Property also effects how some Aggregates are calculated. A value of True
    //  indicates the stepped interpolation mode. A value of False indicates SlopedInterpolation
    //  mode. The default value is False.
    historicalDataConfiguration.stepped.setValueFromSource({ dataType: "Boolean", value: false });

    // The MaxTimeInterval Variable specifies the maximum interval between data points in the
    // history repository regardless of their value change (see Part 3 for definition of Duration).
    historicalDataConfiguration.maxTimeInterval?.setValueFromSource({ dataType: "Duration", value: 10 * 1000 });

    // The MinTimeInterval Variable specifies the minimum interval between data points in the
    // history repository regardless of their value change
    historicalDataConfiguration.minTimeInterval?.setValueFromSource({ dataType: "Duration", value: 0.1 * 1000 });

    // The StartOfArchive Variable specifies the date before which there is no data in the archive
    //  either online or offline.

    // The StartOfOnlineArchive Variable specifies the date of the earliest data in the online archive.
    const startOfOnlineArchive = new Date();
    historicalDataConfiguration.startOfOnlineArchive?.setValueFromSource({
        dataType: DataType.DateTime,
        value: startOfOnlineArchive
    });

    // TreatUncertainAsBad
    // The TreatUncertainAsBad Variable indicates how the Server treats data returned with a
    //    StatusCode severity Uncertain with respect to Aggregate calculations. A value of True indicates
    // the Server considers the severity equivalent to Bad, a value of False indicates the Server
    // considers the severity equivalent to Good, unless the Aggregate definition says otherwise. The
    // default value is True. Note that the value is still treated as Uncertain when the StatusCode for
    // the result is calculated.
    historicalDataConfiguration.aggregateConfiguration.treatUncertainAsBad.setValueFromSource({
        dataType: "Boolean",
        value: true
    });

    // The PercentDataBad Variable indicates the minimum percentage of Bad data in a given interval required for the
    // StatusCode for the given interval for processed data request to be set to Bad.
    // (Uncertain is treated as defined above.) Refer to 5.4.3 for details on using this Variable when assigning
    // StatusCodes. For details on which Aggregates use the PercentDataBad Variable, see
    // the definition of each Aggregate. The default value is 100.
    historicalDataConfiguration.aggregateConfiguration.percentDataBad.setValueFromSource({
        dataType: "Byte",
        value: 100
    });

    // The PercentDataGood Variable indicates the minimum percentage of Good data in a given
    // interval required for the StatusCode for the given interval for the processed data requests to be
    // set to Good. Refer to 5.4.3 for details on using this Variable when assigning StatusCodes. For
    // details on which Aggregates use the PercentDataGood Variable, see the definition of each
    // Aggregate. The default value is 100.
    historicalDataConfiguration.aggregateConfiguration.percentDataGood.setValueFromSource({
        dataType: "Byte",
        value: 100
    });

    //
    // The PercentDataGood and PercentDataBad shall follow the following relationship
    // PercentDataGood ≥ (100 – PercentDataBad). If they are equal the result of the
    // PercentDataGood calculation is used. If the values entered for PercentDataGood and
    //
    // PercentDataBad do not result in a valid calculation (e.g. Bad = 80; Good = 0) the result will
    // have a StatusCode of Bad_AggregateInvalidInputs The StatusCode
    //
    // Bad_AggregateInvalidInputs will be returned if the value of PercentDataGood or
    // PercentDataBad exceed 100.

    node.$historicalDataConfiguration = historicalDataConfiguration;

    const dataValue = node.readValue();
    if (
        dataValue.statusCode !== StatusCodes.BadWaitingForInitialData &&
        dataValue.statusCode !== StatusCodes.UncertainInitialValue
    ) {
        on_value_change.call(node, dataValue);
    }
    node.on("value_changed", on_value_change);

    // update the index of historizing nodes in the addressSpace
    node.addressSpace.historizingNodes = node.addressSpace.historizingNodes || {};
    node.addressSpace.historizingNodes[node.nodeId.toString()] = node;
}
