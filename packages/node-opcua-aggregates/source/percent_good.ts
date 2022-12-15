import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { Variant, DataType } from "node-opcua-variant";
import { extraStatusCodeBits, StatusCode, StatusCodes } from "node-opcua-status-code";

import { getAggregateData } from "./common";
import { Interval, AggregateConfigurationOptions } from "./interval";
import { calculateBadAndGood } from "./calculate_bad_good";

function calculatePercentGood(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    //
    // The PercentGood Aggregate defined in Table 44 performs the following calculation:
    //
    //     PercentGood = DurationGood / ProcessingInterval x 100
    // where:
    //
    // DurationGood is the result from the DurationGood *Aggregate*, calculated using the *ProcessingInterval* supplied to *PercentGood* call.
    // ProcessingInterval is the duration of interval.
    // If the last interval is a partial interval then the duration of the partial interval is used in the
    // calculation.
    // Each Aggregate is returned with timestamp of the start of the interval. StatusCodes are Good, Calculated.
    //
    const { percentGood, statusCode } = calculateBadAndGood(interval, options);
    if (percentGood < 0) {
        // special case ! to indicate that no good pointhas been found in the interval
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.Bad,
            value: { dataType: DataType.Null }
        });
    }
    const value = percentGood;
    if (statusCode.isGoodish()) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode,
            value: { dataType: DataType.Double, value }
        });
    }
    return new DataValue({ sourceTimestamp: interval.startTime, statusCode, value: { dataType: DataType.Null } });
}

/**
 *
 * @param node 	Retrieve the percentage of data (0 to 100) in the interval which has Good StatusCode.
 */
export function getPercentGoodData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, calculatePercentGood, callback);
}
