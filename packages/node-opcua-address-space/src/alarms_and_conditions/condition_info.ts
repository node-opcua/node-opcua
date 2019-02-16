/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { UInt16 } from "node-opcua-basic-types";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { StatusCode } from "node-opcua-status-code";
import { ConditionInfoOptions } from "../../source/interfaces/alarms_and_conditions/condition_info_i";

export interface ConditionInfo {
    message: LocalizedText | null;
    quality: StatusCode| null ;
    severity: UInt16| null;
    retain: boolean| null;
    isDifferentFrom(otherConditionInfo: ConditionInfo): boolean;
}
/**
 * @class ConditionInfo
 * @param options  {Object}
 * @param options.message   {String|LocalizedText} the event message
 * @param options.severity  {UInt16} severity
 * @param options.quality   {StatusCode} quality
 * @param options.retain   {Boolean} retain flag
 * @constructor
 */
export class ConditionInfo {

    public message: LocalizedText | null = null;
    public quality: StatusCode | null = null;
    public severity: UInt16 | null = 0;
    public retain: boolean | null = false;

    constructor(options: ConditionInfoOptions) {

        this.severity = null;
        this.quality = null;
        this.message = null;
        this.retain = null;

        if (options.hasOwnProperty("message") && options.message) {
            this.message = LocalizedText.coerce(options.message);
        }
        if (options.hasOwnProperty("quality") && options.quality !== null) {
            this.quality = options.quality!;
        }
        if (options.hasOwnProperty("severity") && options.severity !== null) {
            assert(_.isNumber(options.severity));
            this.severity = options.severity!;
        }
        if (options.hasOwnProperty("retain") && options.retain !== null) {
            assert(_.isBoolean(options.retain));
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
