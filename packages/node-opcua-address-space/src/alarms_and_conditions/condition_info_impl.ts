/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { UInt16 } from "node-opcua-basic-types";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { StatusCode } from "node-opcua-status-code";
import { ConditionInfo, ConditionInfoOptions } from "../../source/interfaces/alarms_and_conditions/condition_info_i";


/**
 * @class ConditionInfo
 * @param options  {Object}
 * @param options.message   {String|LocalizedText} the event message
 * @param options.severity  {UInt16} severity
 * @param options.quality   {StatusCode} quality
 * @param options.retain   {Boolean} retain flag
 * @constructor
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

        if (Object.prototype.hasOwnProperty.call(options, "message") && options.message) {
            this.message = LocalizedText.coerce(options.message);
        }
        if (Object.prototype.hasOwnProperty.call(options, "quality") && options.quality !== null) {
            this.quality = options.quality!;
        }
        if (Object.prototype.hasOwnProperty.call(options, "severity") && options.severity !== null) {
            assert(typeof options.severity === "number");
            this.severity = options.severity!;
        }
        if (Object.prototype.hasOwnProperty.call(options, "retain") && options.retain !== null) {
            assert(typeof options.retain === "boolean");
            this.retain = options.retain!;
        }
    }

    /**
     * @method isDifferentFrom
     * @param otherConditionInfo {ConditionInfo}
     * @return {Boolean}
     */
    public isDifferentFrom(otherConditionInfo: ConditionInfo): boolean {
        return (
            this.severity !== otherConditionInfo.severity ||
            this.quality !== otherConditionInfo.quality ||
            this.message !== otherConditionInfo.message
        );
    }
}
