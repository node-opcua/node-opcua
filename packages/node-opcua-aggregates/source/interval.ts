/**
 * @module node-opca-aggregates
 */
import { DataValue } from "node-opcua-data-value";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { AggregateConfigurationOptions } from "node-opcua-types";
export { AggregateConfigurationOptions } from "node-opcua-types";

export interface AggregateConfigurationOptionsEx extends AggregateConfigurationOptions {
    stepped?: boolean;
}


export function isGoodish2(statusCode: StatusCode, { treatUncertainAsBad }: { treatUncertainAsBad?: boolean }): boolean {
    if (statusCode.isGoodish()) return true;
    if (isUncertain(statusCode)) return !treatUncertainAsBad;
    return false;
}


export function isUncertain(statusCode: StatusCode): boolean {
    return (statusCode.value & 0x40000000) === 0x40000000 && statusCode.value !== StatusCodes.BadNoData.value;
}
export interface IntervalOptions {
    startTime: Date;
    dataValues: DataValue[];
    index: number;
    count: number;
    isPartial: boolean;
    processingInterval: number;
}

interface DataValueWithIndex {
    index: number;
    dataValue: DataValue;
}

export function _findGoodDataValueBefore(
    dataValues: DataValue[],
    index: number,
    bTreatUncertainAsBad: boolean
): DataValueWithIndex {
    index--;
    while (index >= 0) {
        const dataValue1 = dataValues[index];
        if (!bTreatUncertainAsBad && !dataValue1.statusCode.isBad()) {
            return { index, dataValue: dataValue1 };
        }
        if (bTreatUncertainAsBad && dataValue1.statusCode.isGood()) {
            return { index, dataValue: dataValue1 };
        }
        index -= 1;
    }
    // not found
    return {
        dataValue: new DataValue({ statusCode: StatusCodes.BadNoData }),
        index: -1
    };
}

export function _findGoodDataValueAfter(dataValues: DataValue[], index: number, bTreatUncertainAsBad: boolean): DataValueWithIndex {
    while (index < dataValues.length) {
        const dataValue1 = dataValues[index];
        if (!bTreatUncertainAsBad && !dataValue1.statusCode.isBad()) {
            return {
                dataValue: dataValue1,
                index
            };
        }
        if (bTreatUncertainAsBad && dataValue1.statusCode.isGood()) {
            return {
                dataValue: dataValue1,
                index
            };
        }
        index += 1;
    }
    // not found
    return {
        dataValue: new DataValue({ statusCode: StatusCodes.BadNoData }),
        index: -1
    };
}

export function adjustProcessingOptions(options: AggregateConfigurationOptionsEx | null): AggregateConfigurationOptionsEx {
    options = options || {};
    options.treatUncertainAsBad = options.treatUncertainAsBad || false;
    options.useSlopedExtrapolation = options.useSlopedExtrapolation || false;
    options.stepped = options.stepped! || false;
    options.percentDataBad = parseInt(options.percentDataBad as any, 10);
    options.percentDataGood = parseInt(options.percentDataGood as any, 10);
    return options;
}

export class Interval {
    public startTime: Date;
    public dataValues: DataValue[];
    public index: number;
    public count: number;
    public isPartial: boolean;
    public processingInterval: number;

    // startTime
    // dataValues
    // index:       index of first dataValue inside the interval
    // count:       number of dataValue inside the interval
    constructor(options: IntervalOptions) {
        this.startTime = options.startTime;
        this.dataValues = options.dataValues;
        this.index = options.index;
        this.count = options.count;
        this.isPartial = options.isPartial;
        this.processingInterval = options.processingInterval;
    }

    public getPercentBad(): number {
        return 100;
    }

    /**
     * returns true if a raw data exists at start
     */
    public hasRawDataAsStart(): boolean {
        const index = this.index;
        if (index < 0) {
            return false;
        }
        const dataValue1 = this.dataValues[index];
        return this.startTime.getTime() === dataValue1!.sourceTimestamp!.getTime();
    }

    /**
     * Find the first good or uncertain dataValue
     * just preceding this interval
     * @returns {*}
     */
    public beforeStartDataValue(bTreatUncertainAsBad: boolean): DataValueWithIndex {
        return _findGoodDataValueBefore(this.dataValues, this.index, bTreatUncertainAsBad);
    }

    public nextStartDataValue(bTreatUncertainAsBad: boolean): DataValueWithIndex {
        return _findGoodDataValueAfter(this.dataValues, this.index, bTreatUncertainAsBad);
    }

    public toString(): string {
        let str = "";
        str += "startTime " + this.startTime.toUTCString() + "\n";
        str += "start     " + this.index + "  ";
        str += "count     " + this.count + " ";
        str += "isPartial " + this.isPartial + "\n";
        if (this.index >= 0) {
            for (let i = this.index; i < this.index + this.count; i++) {
                const dataValue = this.dataValues[i];
                str += " " + dataValue.sourceTimestamp!.toUTCString() + dataValue.statusCode.toString();
                str += dataValue.value ? dataValue.value.toString() : "";
                str += "\n";
            }
        }
        return str;
    }
    public getEffectiveEndTime(): number {
        const e = this.startTime.getTime() + this.processingInterval;
        if (!this.dataValues || this.dataValues.length === 0) {
            return e;
        }
        let i = this.dataValues.length - 1;
        while (i >= 0 && this.dataValues[i].statusCode.equals(StatusCodes.BadNoData)) {
            i--;
        }
        if (i < 0) {
            return e;
        }
        const lastTimestamp = this.dataValues[i].sourceTimestamp!;
        return Math.min(e, lastTimestamp.getTime() + 1);
    }

    /**
     * 
     * @returns the interval duration
     */
    duration() {
        const t1 = this.dataValues[this.index].sourceTimestamp!.getTime();
        const e = this.getEffectiveEndTime();
        return e - t1;
    }

    /**
     * returns the region duration starting at index and finishing at index+1 or end limit of the interval
     */
    regionDuration(index: number): number {
        const t1 = this.dataValues[index].sourceTimestamp!.getTime();
        const e = this.getEffectiveEndTime();
        const t2 = index < this.dataValues.length - 1 ? Math.min(this.dataValues[index + 1].sourceTimestamp!.getTime(), e) : e;
        return t2 - t1;
    }
}

export function getInterval(startTime: Date, processingInterval: number, indexHint: number, dataValues: DataValue[]): Interval {
    let count = 0;
    let index = -1;
    for (let i = indexHint; i < dataValues.length; i++) {
        if (dataValues[i].sourceTimestamp!.getTime() < startTime.getTime()) {
            continue;
        }
        index = i;
        break;
    }

    if (index >= 0) {
        for (let i = index; i < dataValues.length; i++) {
            if (dataValues[i].sourceTimestamp!.getTime() >= startTime.getTime() + processingInterval) {
                break;
            }
            count++;
        }
    }

    // check if interval is complete or partial (end or start)
    let isPartial = false;
    if (
        index + count >= dataValues.length &&
        dataValues[dataValues.length - 1].sourceTimestamp!.getTime() < startTime.getTime() + processingInterval
    ) {
        isPartial = true;
    }
    if (index <= 0 && dataValues[0].sourceTimestamp!.getTime() > startTime.getTime()) {
        isPartial = true;
    }

    return new Interval({
        count,
        dataValues,
        index,
        isPartial,
        startTime,
        processingInterval
    });
}
