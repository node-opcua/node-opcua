import { DataValue } from "node-opcua-data-value";
import { HistoryData, HistoryReadResult, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";

import { getAggregateConfiguration } from "./aggregates";
import { AggregateConfigurationOptions, getInterval, Interval } from "./interval";

// tslint:disable:no-var-requires
const SessionContext = require("node-opcua-address-space").SessionContext;

export function processAggregateData(
    node: any,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    dataValues: DataValue[],
    lambda: (interval: Interval, aggregateConfiguration: AggregateConfigurationOptions) => DataValue,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
) {
    const aggregateConfiguration = getAggregateConfiguration(node);

    const results: DataValue[] = [];

    const tstart = startDate.getTime();
    const tend = endDate.getTime();

    const indexHint = 0;
    for (let t = tstart; t < tend; t += processingInterval) {
        const sourceTimestamp = new Date();
        sourceTimestamp.setTime(t);

        const interval = getInterval(sourceTimestamp, processingInterval, indexHint, dataValues);

        const dataValue = lambda(interval, aggregateConfiguration);

        if (!dataValue || !dataValue.sourceTimestamp) {
            // const dataValue = interval.interpolatedValue(aggregateConfiguration);
            throw Error("invalid DataValue");
        }
        results.push(dataValue);
    }

    setImmediate(() => {
        callback(null, results);
    });

}

export function getAggregateData(
    node: any,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    lambda: (interval: Interval, aggregateConfiguration: AggregateConfigurationOptions) => DataValue,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
) {

    if (!(node.constructor.name === "UAVariable")) {
        throw new Error("node must be UAVariable");
    }

    if (processingInterval <= 0) {
        throw new Error("Invalid processing interval, shall be greater than 0");
    }

    const context = new SessionContext();
    const historyReadDetails = new ReadRawModifiedDetails({
        endTime: endDate,
        startTime: startDate,
    });
    const indexRange = null;
    const dataEncoding = null;
    const continuationPoint = null;
    node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint,
        (err: Error | null, result?: HistoryReadResult) => {
            if (err) {
                return callback(err);
            }
            const historyData = result!.historyData as HistoryData;

            const dataValues = historyData.dataValues || [];

            processAggregateData(node, processingInterval, startDate, endDate, dataValues, lambda, callback);
        });
}

export function interpolateValue(dataValue1: DataValue, dataValue2: DataValue, date: Date) {
    const t0 = dataValue1.sourceTimestamp!.getTime();
    const t = date.getTime();
    const t1 = dataValue2.sourceTimestamp!.getTime();
    const coef1 = (t - t0) / (t1 - t0);
    const coef2 = (t1 - t) / (t1 - t0);
    const value = dataValue1.value.clone();
    value.value = coef2 * dataValue1.value.value + coef1 * dataValue2.value.value;
    const statusCode = StatusCodes.makeStatusCode(dataValue1.statusCode, "HistorianInterpolated");
    return new DataValue({
        sourceTimestamp: date,
        statusCode,
        value
    });
}
