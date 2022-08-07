/**
 * @module node-opcua-address-space
 */
import { UInt16 } from "node-opcua-basic-types";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { StatusCode } from "node-opcua-status-code";

export interface ConditionInfoOptions {
    message?: string | LocalizedTextLike | null;
    quality?: StatusCode | null;
    severity?: UInt16 | null;
    retain?: boolean | null;
}

export interface ConditionInfo {
    message: LocalizedText | null;
    quality: StatusCode | null;
    severity: UInt16 | null;
    retain: boolean | null;
    isDifferentFrom(otherConditionInfo: ConditionInfo): boolean;
}
