import * as async from "async";
import { AggregateFunction } from "node-opcua-constants";
import { ISessionContext, ContinuationPoint, UAVariable, ContinuationData } from "node-opcua-address-space";
import { NumericRange } from "node-opcua-numeric-range";
import { QualifiedNameLike } from "node-opcua-data-model";
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { DataValue } from "node-opcua-data-value";
import { ObjectIds } from "node-opcua-constants";
import { NodeId } from "node-opcua-nodeid";
import {
    HistoryData,
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";

import { getMinData, getMaxData } from "./minmax";

import { getInterpolatedData } from "./interpolate";
import { getAverageData } from "./average";

function _buildResult(err: Error | null, dataValues: DataValue[] | undefined, callback2: CallbackT<HistoryReadResult>) {
    if (err) {
        return callback2(null, new HistoryReadResult({ statusCode: StatusCodes.BadInternalError }));
    }
    const result = new HistoryReadResult({
        historyData: new HistoryData({
            dataValues
        }),
        statusCode: StatusCodes.Good
    });
    return callback2(null, result);
}

function applyAggregate(
    variable: UAVariable,
    processingInterval: number,
    startTime: Date,
    endTime: Date,
    aggregateType: NodeId,
    callback2: CallbackT<HistoryReadResult>
) {
    if (!startTime || !endTime) {
        return _buildResult(new Error("Invalid date time"), undefined, callback2);
    }
    const buildResult = (err: Error | null, dataValues: DataValue[] | undefined) => {
        _buildResult(err, dataValues, callback2);
    };
    switch (aggregateType.value) {
        case AggregateFunction.Minimum:
            getMinData(variable, processingInterval, startTime, endTime, buildResult);
            break;
        case AggregateFunction.Maximum:
            getMaxData(variable, processingInterval, startTime, endTime, buildResult);
            break;
        case AggregateFunction.Interpolative:
            getInterpolatedData(variable, processingInterval, startTime, endTime, buildResult);
            break;
        case AggregateFunction.Average:
            getAverageData(variable, processingInterval, startTime, endTime, buildResult);
            break;
        case AggregateFunction.Count:
        default:
            // todo provide correct implementation
            return callback2(null, new HistoryReadResult({ statusCode: StatusCodes.BadAggregateNotSupported }));
    }
}
export function readProcessedDetails(
    variable: UAVariable,
    context: ISessionContext,
    historyReadDetails: ReadProcessedDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
): void {
    // OPC Unified Architecture, Part 11 27 Release 1.03
    //
    // This structure is used to compute Aggregate values, qualities, and timestamps from data in
    // the history database for the specified time domain for one or more HistoricalDataNodes. The
    // time domain is divided into intervals of duration ProcessingInterval. The specified Aggregate
    // Type is calculated for each interval beginning with startTime by using the data within the next
    // ProcessingInterval.
    // For example, this function can provide hourly statistics such as Maximum, Minimum , and
    // Average for each item during the specified time domain when ProcessingInterval is 1 hour.
    // The domain of the request is defined by startTime, endTime, and ProcessingInterval. All three
    // shall be specified. If endTime is less than startTime then the data shall be returned in reverse
    // order with the later data coming first. If startTime and endTime are the same then the Server
    // shall return Bad_InvalidArgument as there is no meaningful way to interpret such a case. If
    // the ProcessingInterval is specified as 0 then Aggregates shall be calculated using one interval
    // starting at startTime and ending at endTime.
    // The aggregateType[] parameter allows a Client to request multiple Aggregate calculations per
    // requested NodeId. If multiple Aggregates are requested then a corresponding number of
    // entries are required in the NodesToRead array.
    // For example, to request Min Aggregate for NodeId FIC101, FIC102, and both Min and Max
    // Aggregates for NodeId FIC103 would require NodeId FIC103 to appear twice in the
    // NodesToRead array request parameter.
    // aggregateType[] NodesToRead[]
    // Min FIC101
    // Min FIC102
    // Min FIC103
    // Max FIC103
    // If the array of Aggregates does not match the array of NodesToRead then the Server shall
    // return a StatusCode of Bad_AggregateListMismatch.
    // The aggregateConfiguration parameter allows a Client to override the Aggregate configuration
    // settings supplied by the AggregateConfiguration Object on a per call basis. See Part 13 for
    // more information on Aggregate configurations. If the Server does not support the ability to
    // override the Aggregate configuration settings then it shall return a StatusCode of Bad_
    // AggregateConfigurationRejected. If the Aggregate is not valid for the Node then the
    // StatusCode shall be Bad_AggregateNotSupported.
    // The values used in computing the Aggregate for each interval shall include any value that
    // falls exactly on the timestamp at the beginning of the interval, but shall not include any value
    // that falls directly on the timestamp ending the interval. Thus, each value shall be included
    // only once in the calculation. If the time domain is in reverse order then we consider the later
    // timestamp to be the one beginning the sub interval, and the earlier timestamp to be the one
    // ending it. Note that this means that simply swapping the start and end times will not result in
    // getting the same values back in reverse order as the intervals being requested in the two
    // cases are not the same.
    // If an Aggregate is taking a long time to calculate then the Server can return partial results
    // with a continuation point. This might be done if the calculation is going to take more time th an
    // the Client timeout hint. In some cases it may take longer than the Client timeout hint to
    // calculate even one Aggregate result. Then the Server may return zero results with a
    // continuation point that allows the Server to resume the calculation on the next Client read
    // call.
    const startTime = historyReadDetails.startTime;
    const endTime = historyReadDetails.endTime;
    if (!startTime || !endTime) {
        return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadInvalidArgument }));
    }
    if (startTime.getTime() === endTime.getTime()) {
        // Start = End Int = Anything No intervals. Returns a Bad_InvalidArgument StatusCode,
        // regardless of whether there is data at the specified time or not
        return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadInvalidArgument }));
    }

    const aggregateTypes: NodeId[] = historyReadDetails.aggregateType || [];

    // If the ProcessingInterval is specified as 0 then Aggregates shall be calculated using one interval
    // starting at startTime and ending at endTime.
    const processingInterval = historyReadDetails.processingInterval || endTime.getTime() - startTime.getTime();

    // tslint:disable-next-line: prefer-for-of
    if (historyReadDetails.aggregateType?.length !== 1) {
        return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadInternalError }));
    }
    return applyAggregate(variable, processingInterval, startTime, endTime, aggregateTypes[0], callback);
}
