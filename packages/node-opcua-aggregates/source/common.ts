/**
 * @module node-opca-aggregates
 */
import { SessionContext, UAVariable, ContinuationPointManager, ContinuationPoint } from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { HistoryData, HistoryReadResult, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCode } from "node-opcua-status-code";
import { coerceNodeId } from "node-opcua-nodeid";

import { getAggregateConfiguration } from "./aggregates";
import { getInterval, Interval, AggregateConfigurationOptionsEx } from "./interval";

/**
 * @internal
 * @param node
 * @param processingInterval
 * @param startDate
 * @param endDate
 * @param dataValues
 * @param lambda
 * @param callback
 */
function processAggregateData(
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    dataValues: DataValue[],
    lambda: (interval: Interval, aggregateConfiguration: AggregateConfigurationOptionsEx) => DataValue,
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

        /* istanbul ignore next */
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
    node: UAVariable,
    processingInterval: number,
    startDate: Date,
    endDate: Date,
    lambda: (interval: Interval, aggregateConfiguration: AggregateConfigurationOptionsEx) => DataValue,
    callback: (err: Error | null, dataValues?: DataValue[]) => void
): void {
    /* istanbul ignore next */
    if (node.nodeClass !== NodeClass.Variable) {
        throw new Error("node must be UAVariable");
    }

    /* istanbul ignore next */
    if (processingInterval <= 0) {
        throw new Error("Invalid processing interval, shall be greater than 0");
    }

    const continuationPointManager = new ContinuationPointManager();
    const context = new SessionContext({
        session: {
            continuationPointManager,
            getSessionId: () => coerceNodeId("i=0")
        }
    });
    const historyReadDetails = new ReadRawModifiedDetails({
        endTime: endDate,
        startTime: startDate,
        isReadModified: false,
        numValuesPerNode: 0
        // returnBounds: true,
    });
    const indexRange = null;
    const dataEncoding = null;
    const continuationPoint: ContinuationPoint | null = null;
    node.historyRead(
        context,
        historyReadDetails,
        indexRange,
        dataEncoding,
        { continuationPoint },
        (err: Error | null, result?: HistoryReadResult) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            const historyData = result!.historyData as HistoryData;

            const dataValues = historyData.dataValues || [];

            processAggregateData(node, processingInterval, startDate, endDate, dataValues, lambda, callback);
        }
    );
}

export function interpolateValue(dataValue1: DataValue, dataValue2: DataValue, date: Date): DataValue {
    const t0 = dataValue1.sourceTimestamp!.getTime();
    const t = date.getTime();
    const t1 = dataValue2.sourceTimestamp!.getTime();
    const coef1 = (t - t0) / (t1 - t0);
    const coef2 = (t1 - t) / (t1 - t0);
    const value = dataValue1.value.clone();
    value.value = coef2 * dataValue1.value.value + coef1 * dataValue2.value.value;
    const statusCode = StatusCode.makeStatusCode(dataValue1.statusCode, "HistorianInterpolated");
    return new DataValue({
        sourceTimestamp: date,
        statusCode,
        value
    });
}
