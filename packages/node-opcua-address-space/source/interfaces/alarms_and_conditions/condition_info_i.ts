/**
 * @module node-opcua-address-space
 */
import { UInt16 } from "node-opcua-basic-types";
import { LocalizedTextLike } from "node-opcua-data-model";
import { StatusCode } from "node-opcua-status-code";

export interface ConditionInfoOptions {
    message?: string | LocalizedTextLike | null;
    quality?: StatusCode | null;
    severity?: UInt16 | null;
    retain?: boolean | null;
}
