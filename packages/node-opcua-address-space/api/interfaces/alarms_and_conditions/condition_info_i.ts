/**
 * @module node-opcua-address-space
 */
import type { UInt16 } from "node-opcua-basic-types";
import type { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import type { StatusCode } from "node-opcua-status-code";
import { ConditionInfoImpl } from "../../../impl/alarms_and_conditions/condition_info_impl.js";

export interface ConditionInfoOptions {
    message?: string | LocalizedTextLike | null;
    quality?: StatusCode | null;
    severity?: UInt16 | null;
    retain?: boolean | null;

    time?: Date | null;
    receiveTime?: Date | null;
}

export interface ConditionInfo {
    message: LocalizedText | null;
    quality: StatusCode | null;
    severity: UInt16 | null;
    retain: boolean | null;
    isDifferentFrom(otherConditionInfo: ConditionInfo): boolean;
}

/**
 * The static side of {@link ConditionInfo}, so that `new ConditionInfo({...})` works.
 *
 * Naming the constructor separately keeps the published surface to what a caller needs: a way
 * to build one. The class behind it carries nothing else, but stating the shape here means the
 * implementation can change without the API following it.
 */
export interface ConditionInfoConstructor {
    new (options: ConditionInfoOptions): ConditionInfo;
}

/**
 * Builds the message, severity, quality and retain flag that a condition reports.
 *
 * ```ts
 * alarm.calculateConditionInfo = (state, isActive, value, oldConditionInfo) =>
 *     new ConditionInfo({
 *         message: `Tank is almost ${Math.ceil(value * 100)}% full`,
 *         severity: 100,
 *         quality: StatusCodes.Good,
 *         retain: true
 *     });
 * ```
 *
 * The interface of the same name above is the shape of the result; this is the constructor
 * for it. A type and a value may share a name, which is what lets both live here - and one
 * module has to own the name, or `export *` from two of them is ambiguous.
 *
 * The documentation for the alarm override point has called `new ConditionInfo({...})` for
 * years while only the type was exported and the sole constructor was an internal class, so
 * the example did not run as written and code following it had to reach into the
 * implementation to find one.
 */
export const ConditionInfo: ConditionInfoConstructor = ConditionInfoImpl;
