/**
 * @module node-opcua-server
 */
import type { BaseNode } from "node-opcua-address-space";
import type { ExtensionObject } from "node-opcua-extension-object";
import { type StatusCode } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";
export interface ValidateFilterOptions {
    maxWhereClauseParameters?: number;
    maxSelectClauseParameters?: number;
}
export declare function validateFilter(filter: ExtensionObject | null, itemToMonitor: ReadValueIdOptions, node: BaseNode, options?: ValidateFilterOptions): StatusCode;
//# sourceMappingURL=validate_filter.d.ts.map