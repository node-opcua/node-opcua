/**
 * @module node-opca-aggregates
 */
//  excerpt from OPC Unified Architecture, Part 13 21 Release 1.04
// 5.4.3.10 Minimum
// The Minimum Aggregate defined in Table 21 retrieves the minimum Good raw value within the
// interval, and returns that value with the timestamp at the start of the interval. Note that if the
// same minimum exists at more than one timestamp the MultipleValues bit is set.
//
// Unless otherwise indicated, StatusCodes are Good, Calculated. If the minimum value is on
// the start time the status code will be Good, Raw. If only Bad quality values are available then
// the status is returned as Bad_NoData.
//
// The timestamp of the Aggregate will always be the start of the interval for every
// ProcessingInterval.
//
// Table 21 – Minimum Aggregate summary
//
// Minimum Aggregate Characteristics
//
// Type                     Calculated
// Data                     Type Same as Source
// Use Bounds               None
// Timestamp                StartTime
//
// Status Code  Calculations
//
// Calculation Method       Custom
// If no Bad values then the Status is Good. If Bad values exist then
// the Status is Uncertain_SubNormal. If an Uncertain value is less
// than the minimum Good value the Status is Uncertain_SubNormal.
//
// Partial                  Set Sometimes
// If an interval is not a complete interval
//
// Calculated               Set Sometimes
// If the Minimum value is not on the StartTime of the interval or if the
// Status was set to Uncertain_SubNormal because of non-Good
// values in the interval
//
// Interpolated             Not Set
// Raw                      Set Sometimes
// If Minimum value is on the StartTime of the interval
//
// Multi Value              Set Sometimes
// If multiple Good values exist with the Minimum value
//
// Status Code Common Special Cases
// Before Start of Data     Bad_NoData
// After End of Data        Bad_NoData
// No Start Bound           Not Applicable
// No End Bound             Not Applicable
// Bound Bad                Not Applicable
// Bound Uncertain          Not Applicable
import { UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";

import { getAggregateData } from "./common";
import { AggregateConfigurationOptions, Interval, isGood } from "./interval";

// eslint-disable-next-line max-statements
function calculateIntervalMinOrMaxValue(
    interval: Interval,
    options: AggregateConfigurationOptions,
    predicate: (a: Variant, b: Variant) => "equal" | "select" | "reject"
): DataValue {
    //   console.log(interval.toString());

    const indexStart = interval.index;
    let selectedValue: Variant | null = null;

    let counter = 0;
    let statusCode: StatusCode;
    let isPartial = interval.isPartial;

    let isRaw = false;
    let hasBad = false;

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

        if (!selectedValue) {
            selectedValue = dataValue.value;
            counter = 1;
            if (i === indexStart && dataValue.sourceTimestamp!.getTime() === interval.startTime.getTime()) {
                isRaw = true;
            }
            continue;
        }
        const compare = predicate(selectedValue, dataValue.value);
        if (compare === "equal") {
            counter = 1;
            continue;
        }
        if (compare === "select") {
            selectedValue = dataValue.value;
            counter = 1;
        }
    }

    if (!selectedValue) {
        return new DataValue({
            sourceTimestamp: interval.startTime,
            statusCode: StatusCodes.BadNoData
        });
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

    if (counter > 1) {
        statusCode = StatusCode.makeStatusCode(statusCode, "HistorianMultiValue");
    }
    if (isPartial || interval.isPartial) {
        statusCode = StatusCode.makeStatusCode(statusCode, "HistorianPartial");
    }

    return new DataValue({
        sourceTimestamp: interval.startTime,
        statusCode: statusCode as StatusCode,
        value: selectedValue!
    });
}

export function calculateIntervalMinValue(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    return calculateIntervalMinOrMaxValue(interval, options, (a: Variant, b: Variant) =>
        a.value > b.value ? "select" : a.value === b.value ? "equal" : "reject"
    );
}

export function calculateIntervalMaxValue(interval: Interval, options: AggregateConfigurationOptions): DataValue {
    return calculateIntervalMinOrMaxValue(interval, options, (a: Variant, b: Variant) =>
        a.value < b.value ? "select" : a.value === b.value ? "equal" : "reject"
    );
}

// From OPC Unified Architecture, Part 13 26 Release 1.04
// 5.4.3.11 Maximum
// The Maximum Aggregate defined in Table 22 retrieves the maximum Good raw value within
// the interval, and returns that value with the timestamp at the start of the interval. Note that if
// the same maximum exists at more than one timestamp the MultipleValues bit is set.
// Unless otherwise indicated, StatusCodes are Good, Calculated. If the minimum value is on
// the interval start time the status code will be Good, Raw. If only Bad quality values are
// available then the status is returned as Bad_NoData.
// The timestamp of the Aggregate will always be the start of the interval for every
//
// ProcessingInterval.
//
// Table 22 – Maximum Aggregate summary
// Maximum Aggregate Characteristics
//
// Type                     Calculated
// Data Type                Same as Source
// Use Bounds               None
// Timestamp                StartTime
//
// Status Code Calculations
// Calculation              Method Custom
// If no Bad values then the Status is Good. If Bad values exist then
// the Status is Uncertain_SubNormal. If an Uncertain value is greater
// than the maximum Good value the Status is Uncertain_SubNormal
//
// Partial                  Set Sometimes
// If an interval is not a complete interval
//
// Calculated               Set Sometimes
// If the Maximum value is not on the startTime of the interval or if the
// Status was set to Uncertain_SubNormal because of non-Good
// values in the interval
//
// Interpolated             Not Set
//
// Raw                      Set Sometimes
// If Maximum value is on the startTime of the interval
// Multi Value Set Sometimes
// If multiple Good values exist with the Maximum value
//
// Status Code Common Special Cases
// Before Start of Data     Bad_NoData
// After End of Data        Bad_NoData
// No Start Bound           Not Applicable
// No End Bound             Not Applicable
// Bound Bad                Not Applicable
// Bound Uncertain             Not Applicable
/**
 *
 * @param node
 * @param processingInterval
 * @param startDate
 * @param endDate
 * @param callback
 */
export function getMinData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    return getAggregateData(node, processingInterval, startDate, endDate, calculateIntervalMinValue, callback);
}

export function getMaxData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    return getAggregateData(node, processingInterval, startDate, endDate, calculateIntervalMaxValue, callback);
}
