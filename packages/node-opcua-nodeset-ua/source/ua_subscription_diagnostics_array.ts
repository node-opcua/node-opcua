// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
import { UASubscriptionDiagnostics } from "./ua_subscription_diagnostics"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |SubscriptionDiagnosticsArrayType i=2171                     |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTSubscriptionDiagnostics[] i=874                           |
 * |value rank      |1                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UASubscriptionDiagnosticsArray_Base<T extends DTSubscriptionDiagnostics[]>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    subscriptionDiagnostics: UASubscriptionDiagnostics<DTSubscriptionDiagnostics>;
}
export interface UASubscriptionDiagnosticsArray<T extends DTSubscriptionDiagnostics[]> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASubscriptionDiagnosticsArray_Base<T> {
}