/**
 * @module node-opcua-address-space
 */

import type { DTSubscriptionDiagnostics, UASubscriptionDiagnostics } from "node-opcua-nodeset-ua";
import type { SubscriptionDiagnosticsDataType } from "node-opcua-types";
export interface UASubscriptionDiagnosticsVariableEx extends UASubscriptionDiagnostics<DTSubscriptionDiagnostics> {
    $extensionObject: SubscriptionDiagnosticsDataType;
}
