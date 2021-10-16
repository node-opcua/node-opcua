/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";

export interface HistoryServerCapabilitiesOptions {
    accessHistoryDataCapability?: boolean;
    accessHistoryEventsCapability?: boolean;
    maxReturnDataValues?: number;
    maxReturnEventValues?: number;
    insertDataCapability?: boolean;
    replaceDataCapability?: boolean;
    updateDataCapability?: boolean;
    deleteRawCapability?: boolean;
    deleteAtTimeCapability?: boolean;
    insertEventCapability?: boolean;
    replaceEventCapability?: boolean;
    updateEventCapability?: boolean;
    deleteEventCapability?: boolean;
    insertAnnotationCapability?: boolean;
}
/**
 */
export class HistoryServerCapabilities {
    public accessHistoryDataCapability: boolean;
    public accessHistoryEventsCapability: boolean;
    public maxReturnDataValues: number;
    public maxReturnEventValues: number;
    public insertDataCapability: boolean;
    public replaceDataCapability: boolean;
    public updateDataCapability: boolean;
    public deleteRawCapability: boolean;
    public deleteAtTimeCapability: boolean;
    public insertEventCapability: boolean;
    public replaceEventCapability: boolean;
    public updateEventCapability: boolean;
    public deleteEventCapability: boolean;
    public insertAnnotationCapability: boolean;

    constructor(options?: HistoryServerCapabilitiesOptions) {
        options = options || {};

        function coerceBool(value: boolean | undefined, defaultValue: boolean): boolean {
            if (undefined === value) {
                return defaultValue;
            }
            assert(typeof value === "boolean");
            return value as boolean;
        }

        function coerceUInt32(value: number | undefined, defaultValue: number): number {
            if (undefined === value) {
                return defaultValue;
            }
            assert(typeof value === "number");
            return value;
        }

        this.accessHistoryDataCapability = coerceBool(options.accessHistoryDataCapability, false);
        this.accessHistoryEventsCapability = coerceBool(options.accessHistoryEventsCapability, false);
        this.maxReturnDataValues = coerceUInt32(options.maxReturnDataValues, 0);
        this.maxReturnEventValues = coerceUInt32(options.maxReturnEventValues, 0);
        this.insertDataCapability = coerceBool(options.insertDataCapability, false);
        this.replaceDataCapability = coerceBool(options.replaceDataCapability, false);
        this.updateDataCapability = coerceBool(options.updateDataCapability, false);
        this.deleteRawCapability = coerceBool(options.deleteRawCapability, false);
        this.deleteAtTimeCapability = coerceBool(options.deleteAtTimeCapability, false);
        this.insertEventCapability = coerceBool(options.insertEventCapability, false);
        this.replaceEventCapability = coerceBool(options.replaceEventCapability, false);
        this.updateEventCapability = coerceBool(options.updateEventCapability, false);
        this.deleteEventCapability = coerceBool(options.deleteEventCapability, false);
        this.insertAnnotationCapability = coerceBool(options.insertAnnotationCapability, false);
    }
}
