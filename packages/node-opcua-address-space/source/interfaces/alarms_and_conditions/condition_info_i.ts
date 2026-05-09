/**
 * @module node-opcua-address-space
 */
import type { UInt16 } from "node-opcua-basic-types";
import type { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import type { StatusCode } from "node-opcua-status-code";

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
