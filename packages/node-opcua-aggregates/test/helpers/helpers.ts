import { DataValue } from "node-opcua-data-value";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

const year = 2018;
const month = 10;
const day = 9;

export function makeDate(time: string): Date {
    const [hours, minutes, seconds] = time.split(":").map((x: string) => parseInt(x, 10));
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

export function makeDataValue(time: string, value: number | boolean | null, statusCode: StatusCode): DataValue {
    // setup data
    const sourceTimestamp = makeDate(time);

    if (value === undefined || value === null) {
        return new DataValue({
            sourceTimestamp,
            statusCode,
            value: undefined
        });
    } else if (typeof value === "boolean") {
        return new DataValue({
            sourceTimestamp,
            statusCode,
            value: { dataType: DataType.Boolean, value }
        });
    } else {
        return new DataValue({
            sourceTimestamp,
            statusCode,
            value: { dataType: DataType.Float, value }
        });
    }
}
