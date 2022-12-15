import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { DataType } from "node-opcua-variant";

import { getAggregateData } from "./common";
import { Interval, AggregateConfigurationOptions } from "./interval";
import { calculateBadAndGood } from "./calculate_bad_good";

function calculatePercentBad(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    const { percentBad, statusCode } = calculateBadAndGood(interval, options);
    const value = percentBad;
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
export function getPercentBadData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, calculatePercentBad, callback);
}
