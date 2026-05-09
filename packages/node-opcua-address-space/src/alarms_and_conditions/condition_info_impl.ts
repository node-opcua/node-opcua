/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import type { UInt16 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import type { StatusCode } from "node-opcua-status-code";
import type { ConditionInfo, ConditionInfoOptions } from "../../source/interfaces/alarms_and_conditions/condition_info_i";

/**
 * @private
 */
export class ConditionInfoImpl implements ConditionInfo {
    public message: LocalizedText | null = null;
    public quality: StatusCode | null = null;
    public severity: UInt16 | null = 0;
    public retain: boolean | null = false;

    constructor(options: ConditionInfoOptions) {
        this.severity = null;
        this.quality = null;
        this.message = null;
        this.retain = null;

        if (Object.hasOwn(options, "message") && options.message) {
            this.message = LocalizedText.coerce(options.message);
        }
        if (Object.hasOwn(options, "quality") && options.quality) {
            this.quality = options.quality;
        }
        if (Object.hasOwn(options, "severity") && options.severity !== null) {
            this.severity = options.severity || 0;
        }
        if (Object.hasOwn(options, "retain") && options.retain !== null) {
            this.retain = options.retain || false;
        }
    }
    public isDifferentFrom(otherConditionInfo: ConditionInfo): boolean {
        return (
            this.severity !== otherConditionInfo.severity ||
            this.quality !== otherConditionInfo.quality ||
            this.message !== otherConditionInfo.message
        );
    }
}
