import { extraStatusCodeBits, StatusCode, StatusCodes } from "node-opcua-status-code";

import { Interval, AggregateConfigurationOptions, isUncertain } from "./interval";


const a = (s: StatusCode | undefined, options: AggregateConfigurationOptions) =>
    !s || s === StatusCodes.BadNoData
        ? StatusCodes.BadNoData
        : s.isBad() || (options.treatUncertainAsBad && isUncertain(s))
        ? StatusCodes.Bad
        : StatusCodes.Good;

function findLowBound(
    interval: Interval,
    options: AggregateConfigurationOptions
): { previousStatus: StatusCode; previousTime: number; indexStart: number } {
    const indexStart: number = interval.index;

    const initialValue = interval.dataValues[indexStart];
    if (initialValue.sourceTimestamp!.getTime() === interval.startTime.getTime()) {
        return { previousStatus: initialValue.statusCode, previousTime: interval.startTime.getTime(), indexStart: indexStart + 1 };
    }
    const previousStatus =
        indexStart === 0 || !interval.dataValues[indexStart - 1]
            ? StatusCodes.BadNoData
            : a(interval.dataValues[indexStart - 1].statusCode, options);
    const previousTime = interval.startTime.getTime();
    return { previousStatus, previousTime, indexStart };
}

// eslint-disable-next-line max-statements, complexity
export function calculateBadAndGood(
    interval: Interval,
    options: AggregateConfigurationOptions
): {
    durationGood: number;
    durationBad: number;
    durationUnknown: number;
    percentBad: number;
    percentGood: number;
    statusCode: StatusCode;
} {
    if (interval.count === 0) {
        return {
            durationGood: 0,
            durationBad: 0,
            durationUnknown: 0,
            percentBad: 0,
            percentGood: 0,
            statusCode: StatusCodes.BadNoData
        };
    }
    let durationGood = 0;
    let durationBad = 0;
    let durationUnknown = 0;

    let partialFlag = interval.isPartial ? extraStatusCodeBits.HistorianPartial : 0;

    let { previousStatus, previousTime, indexStart } = findLowBound(interval, options);

    if (previousStatus === StatusCodes.BadNoData) {
        partialFlag = extraStatusCodeBits.HistorianPartial;
        previousStatus = StatusCodes.Bad;
    }

    let nbGood = 0;
    let nbBad = 0;
    let nbUncertain = 0;
    indexStart += 0;
    for (let i = indexStart; i < interval.index + interval.count; i++) {
        const dataValue = interval.dataValues[i];
        if (dataValue.statusCode.isGoodish()) {
            nbGood++;
        }
        if (isUncertain(dataValue.statusCode)) {
            nbUncertain++;
        }
        if (dataValue.statusCode.isBad()) {
            nbBad++;
        }
        const currentStatus = a(dataValue.statusCode, options);
        if (currentStatus === StatusCodes.BadNoData) {
            partialFlag = extraStatusCodeBits.HistorianPartial;
        }
        const currentTime = dataValue.sourceTimestamp!.getTime();

        // debugLog(" ", dataValue.sourceTimestamp?.toISOString(), dataValue.statusCode.toString(), dataValue.value.value);

        if (currentStatus === previousStatus) continue;
        if (previousStatus === StatusCodes.Good) {
            // if (isBadWithUncertain(currentStatus, options.treatUncertainAsBad)) {
            //     durationBad += currentTime - previousTime;
            // } else {
            durationGood += currentTime - previousTime;
            // }
        } else if (previousStatus === StatusCodes.BadNoData) {
            durationUnknown += currentTime - previousTime;
        } else {
            durationBad += currentTime - previousTime;
        }
        previousStatus = currentStatus;
        previousTime = currentTime;
    }

    // final step
    const currentTime = interval.getEffectiveEndTime();
    if (previousStatus === StatusCodes.Good) {
        durationGood += currentTime - previousTime;
    } else if (previousStatus === StatusCodes.BadNoData) {
        durationUnknown += currentTime - previousTime;
    } else {
        durationBad += currentTime - previousTime;
    }

    if (nbGood === 0) {
        if (nbBad > 0) {
            // we need at lest a Good Status in the intervale to be good & no bad !
            durationGood = -1;
        } else {
            durationGood = 0;
        }
    }
    const effectiveProcessingInterval = currentTime - interval.startTime.getTime();

    const percentGood = (durationGood / effectiveProcessingInterval) * 100;
    const percentBad = (durationBad / effectiveProcessingInterval) * 100;

    let percentDataGood = options.percentDataGood === undefined ? 100 : options.percentDataGood;
    const percentDataBad = options.percentDataBad === undefined ? 100 : options.percentDataBad;

    if (percentBad >= percentDataBad || (nbGood === 0 && nbUncertain === 0)) {
        durationGood = 0; // BAD
        percentDataGood = -1;
        // const statusCode = StatusCodes.Bad;
        //return { durationGood, durationBad, durationUnknown, percentBad, percentGood, statusCode };
    }
    const statusCode = StatusCode.makeStatusCode(StatusCodes.Good, extraStatusCodeBits.HistorianCalculated | partialFlag);

    return { durationGood, durationBad, durationUnknown, percentBad, percentGood, statusCode };
}
