import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { extraStatusCodeBits, StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import { getAggregateData } from "./common";
import { Interval, AggregateConfigurationOptions, isUncertain } from "./interval";

/**
 * The Count Aggregate retrieves a count of all the raw values within an interval.
 *  If one or more raw values are non-Good, they are not included in the count, and the Aggregate
 *  StatusCode is determined using the StatusCode Calculation for non-time based Aggregates.
 * If no Good data exists for an interval, the count is zero.
 */
function calculateCountValue(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    const indexStart = interval.index;
    let statusCode: StatusCode = StatusCodes.Good;
    let isPartial = interval.isPartial;

    let nbBad = 0;
    let nbGood = 0;
    let nbUncertain = 0;
    let badDuration = 0;
    let uncertainDuration = 0;
    let goodDuration = 0;
    for (let i = indexStart; i < indexStart + interval.count; i++) {
        const dataValue = interval.dataValues[i];
        if (dataValue.statusCode.equals(StatusCodes.BadNoData)) {
            isPartial = true;
            continue;
        }
        const regionDuration = interval.regionDuration(i);
        if (dataValue.statusCode.isBad()) {
            nbBad++;
            badDuration += regionDuration;
        } else if (isUncertain(dataValue.statusCode)) {
            nbUncertain++;
            uncertainDuration += regionDuration;
        } else if (dataValue.statusCode.isGoodish()) {
            nbGood++;
            goodDuration += regionDuration;
        }
    }

    const partialFlag = isPartial ? extraStatusCodeBits.HistorianPartial : 0;

    // debugLog(" ", goodDuration, uncertainDuration, badDuration);

    if (nbBad > 0) {
        const duration = interval.duration();
        if (options.treatUncertainAsBad) {
            badDuration += uncertainDuration;
        }
        const actualPercentDataBad = (badDuration / duration) * 100.0;
        const percentDataBad = options.percentDataBad === undefined ? 100 : options.percentDataBad;
        if (actualPercentDataBad >= percentDataBad) {
            return new DataValue({
                sourceTimestamp: interval.startTime,
                statusCode: StatusCodes.Bad
            });
        }
    }
    if (nbUncertain > 0 || nbBad > 0) {
        statusCode = StatusCode.makeStatusCode(
            StatusCodes.UncertainDataSubNormal,
            extraStatusCodeBits.HistorianCalculated | partialFlag
        );
    } else {
        statusCode = StatusCode.makeStatusCode(StatusCodes.Good, extraStatusCodeBits.HistorianCalculated | partialFlag);
    }

    if (nbUncertain === 0 && nbGood === 0) {
        statusCode = StatusCodes.BadNoData;
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: statusCode as StatusCode
        });
    }

    return new DataValue({
        sourceTimestamp: interval.startTime,
        statusCode: statusCode as StatusCode,
        value: {
            dataType: DataType.UInt32,
            value: nbGood
        }
    });
}

export function getCountData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, calculateCountValue, callback);
}
