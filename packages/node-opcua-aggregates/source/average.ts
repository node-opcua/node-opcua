import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { Variant, DataType } from "node-opcua-variant";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { getAggregateData } from "./common";
import { Interval, AggregateConfigurationOptions, isGood } from "./interval";

function calculateIntervalAverageValue(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    const indexStart = interval.index;
    let statusCode: StatusCode;
    let isPartial = interval.isPartial;

    const isRaw = false;
    let hasBad = false;

    const values: number[] = [];

    for (let i = indexStart; i < indexStart + interval.count; i++) {
        const dataValue = interval.dataValues[i];

        if (dataValue.statusCode === StatusCodes.BadNoData) {
            isPartial = true;
            continue;
        }

        if (!isGood(dataValue.statusCode)) {
            hasBad = true;
            continue;
        }
        values.push(dataValue.value.value);
    }

    if (isRaw) {
        if (hasBad) {
            statusCode = StatusCodes.UncertainDataSubNormal;
        } else {
            statusCode = StatusCodes.Good;
        }
    } else if (hasBad) {
        statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianCalculated");
    } else {
        statusCode = StatusCode.makeStatusCode(StatusCodes.Good, "HistorianCalculated");
    }
    if (values.length === 0) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.BadNoData
        });
    }
    const mean = values.reduce((p, c) => p + c, 0) / values.length;

    return new DataValue({
        sourceTimestamp: interval.startTime,
        statusCode: statusCode as StatusCode,
        value: {
            dataType: DataType.Double,
            value: mean
        }
    });
}

export function getAverageData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, calculateIntervalAverageValue, callback);
}
