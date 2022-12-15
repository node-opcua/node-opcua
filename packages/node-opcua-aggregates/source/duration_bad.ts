import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { DataType } from "node-opcua-variant";
import { StatusCodes } from "node-opcua-status-code";

import { getAggregateData } from "./common";
import { Interval, AggregateConfigurationOptions } from "./interval";
import { calculateBadAndGood } from "./calculate_bad_good";

function calculateDurationBad(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    const { durationBad, durationUnknown, statusCode } = calculateBadAndGood(interval, options);
    if (durationUnknown > 0 && durationBad === 0) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.Bad
        });
    }
    const value = durationBad;
    if (statusCode.isGoodish()) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode,
            value: { dataType: DataType.Double, value }
        });
    }
    return new DataValue({ sourceTimestamp: interval.startTime, statusCode, value: { dataType: DataType.Null } });
}
/**Retrieve the percentage of data (0 to 100) in the interval which has Bad StatusCode. */
export function getDurationBadData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, calculateDurationBad, callback);
}
