/**
 * @module node-opcua-address-space
 */
import { SubscriptionDiagnosticsDataType } from "node-opcua-types";
import { DTSubscriptionDiagnostics, UASubscriptionDiagnostics } from "node-opcua-nodeset-ua";
export interface UASubscriptionDiagnosticsVariableEx extends UASubscriptionDiagnostics<DTSubscriptionDiagnostics> {
    $extensionObject: SubscriptionDiagnosticsDataType;
}
