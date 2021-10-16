/**
 * @module node-opcua-aggregates
 */
//  excerpt from OPC Unified Architecture, Part 13 21 Release 1.04
//
// 5.4.3.4 Interpolative
// The Interpolative Aggregate defined in Table 15 returns the Interpolated Bounding Value for the startTime
// of each interval.
// When searching for Good values before or after the bounding value, the time period searched is Server specific,
// but the Server should search a time range which is at least the size of the ProcessingInterval.
//
//                                 Interpolated Aggregate Characteristics
//
// Type                        Interpolated
// Data Type                   Same as Source
// Use Bounds                  Interpolated
// Timestamp                   StartTime
// Status Code                 Calculations
// Calculation                 Method Custom
//                             Good if no  Bad values skipped and Good values are used,
//                             Uncertain if Bad values skipped or if Uncertain values are used. If
//                             no starting value then BadNoData.
// Partial bit                 Not Set
// Calculated bit              Not Set
// Interpolated bit            Set Sometimes
//                             Always set except for when the Raw bit is set
// Raw bit                     Set Sometimes
//                             If a value exists with the exact time of interval Start
// Multi Value bit             Not Set
//
// Status Code Common Special Cases
// Before Start of Data        Return BadNoData
// After End of Data           Return extrapolated value (see 3.1.8) (sloped or stepped according to settings)
//                             Status code is Uncertain_DataSubNormal.
// Start Bound Not Found       BadNoData.
// End Bound Not Found         See “After End of Data”
// Bound Bad                   Does not return a Bad bound except as noted above
// Bound Uncertain             Returned Uncertain_DataSubNormal if any Bad value(s) was/were skipped to
//                             calculate the bounding value.
import { UAVariable } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { getAggregateData, interpolateValue } from "./common";
import {
    _findGoodDataValueBefore,
    adjustProcessingOptions,
    AggregateConfigurationOptionsEx,
    Interval,
    isBad,
    isGood
} from "./interval";

/*
 For any intervals containing regions where the StatusCodes are Bad,
 the total duration of all Bad regions is calculated and divided by the width of the interval.
 The resulting ratio is multiplied by 100 and compared to the PercentDataBad parameter.
 The StatusCode for the interval is Bad if the ratio is greater than or equal to the PercentDataBad parameter.
 For any interval which is not Bad, the total duration of all Good regions is then calculated and divided by
 the width of the interval. The resulting ratio is multiplied by 100 and compared to the PercentDataGood parameter.
 The StatusCode for the interval is Good if the ratio is greater than or equal to the PercentDataGood parameter.
 If for an interval neither ratio applies then that interval is Uncertain_DataSubNormal.
  */
export function interpolatedValue(interval: Interval, options: AggregateConfigurationOptionsEx): DataValue {
    options = adjustProcessingOptions(options);

    assert(Object.prototype.hasOwnProperty.call(options, "useSlopedExtrapolation"));
    assert(Object.prototype.hasOwnProperty.call(options, "treatUncertainAsBad"));

    const bTreatUncertainAsBad = options.treatUncertainAsBad!;

    const steppedValue = (previousDataValue: DataValue): DataValue => {
        if (!previousDataValue.statusCode) {
            throw new Error("Expecting statusCode");
        }
        const interpValue = new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.Bad,
            value: previousDataValue.value
        });
        interpValue.statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianInterpolated");
        return interpValue;
    };

    if (interval.index === -1) {
        // the interval is beyond end Data
        // we need to find previous good value
        // and second previous  good value to extrapolate
        const prev1 = _findGoodDataValueBefore(interval.dataValues, interval.dataValues.length, bTreatUncertainAsBad);
        if (prev1.index <= 0) {
            return new DataValue({
                sourceTimestamp: interval.startTime,
                statusCode: StatusCodes.BadNoData,
                value: undefined
            });
        }
        if (!options.useSlopedExtrapolation) {
            return steppedValue(prev1.dataValue);
        }
        const prev2 = _findGoodDataValueBefore(interval.dataValues, prev1.index, bTreatUncertainAsBad);

        if (prev2.index <= 0) {
            // use step value
            return steppedValue(prev1.dataValue);
        }
        // else interpolate
        const interpVal = interpolateValue(prev2.dataValue, prev1.dataValue, interval.startTime);

        // tslint:disable:no-bitwise
        if (prev2.index + 1 < prev1.index || prev1.index < interval.dataValues.length - 1) {
            // some bad data exist in between = change status code
            const mask = 0x0000ffffff;
            const extraBits = interpVal.statusCode.value & mask;
            interpVal.statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, extraBits);
        }

        return interpVal;
    }

    /* istanbul ignore next */
    if (interval.index < 0 && interval.count === 0) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.BadNoData
        });
    }

    const dataValue1 = interval.dataValues[interval.index];

    // if a non-Bad Raw value exists at the timestamp then it is the bounding value;
    if (!isBad(dataValue1.statusCode) && interval.hasRawDataAsStart()) {
        return dataValue1;
    }
    // find the first non-Bad Raw value before the timestamp;

    // find previous good value
    const before = interval.beforeStartDataValue(bTreatUncertainAsBad);
    if (isBad(before.dataValue.statusCode)) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.BadNoData
        });
    }

    if (options.stepped) {
        if (before.index + 1 === interval.index) {
            return new DataValue({
                sourceTimestamp: interval.startTime,
                statusCode: StatusCode.makeStatusCode(before.dataValue.statusCode, "HistorianInterpolated"),
                value: before.dataValue.value
            });
        }
        return steppedValue(before.dataValue);
    }
    // find the first non-Bad Raw value after the timestamp;
    const next = interval.nextStartDataValue(bTreatUncertainAsBad);

    //  draw a line between before value and after value;
    // use point where the line crosses the timestamp as an estimate of the bounding value.
    //   The calculation can be expressed with the following formula:
    //    V bound = (T bound – T before)x( V after – V before)/( T after – T before) + V before
    //    where V
    //   x is a value at ‘x’ and Tx is the timestamp associated with Vx.
    const interpolatedDataValue = interpolateValue(before.dataValue, next.dataValue, interval.startTime);

    if (before.index + 1 < next.index || !isGood(next.dataValue.statusCode) || !isGood(before.dataValue.statusCode)) {
        // tslint:disable:no-bitwise
        // some bad data exist in between = change status code
        const mask = 0x0000ffffff;
        const extraBits = interpolatedDataValue.statusCode.value & mask;
        interpolatedDataValue.statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, extraBits);
    }
    // check if uncertain or bad value exist between before/next
    // todo
    return interpolatedDataValue;
}

/**
 *
 * @param node
 * @param processingInterval
 * @param startDate
 * @param endDate
 * @param callback
 */
export function getInterpolatedData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    getAggregateData(node, processingInterval, startDate, endDate, interpolatedValue, callback);
}
