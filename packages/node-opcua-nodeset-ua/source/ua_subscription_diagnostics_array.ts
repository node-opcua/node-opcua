// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
import { UASubscriptionDiagnostics } from "./ua_subscription_diagnostics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SubscriptionDiagnosticsArrayType ns=0;i=2171      |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSubscriptionDiagnostics[] ns=0;i=874            |
 * |isAbstract      |false                                             |
 */
export interface UASubscriptionDiagnosticsArray_Base<T extends DTSubscriptionDiagnostics[]/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    subscriptionDiagnostics: UASubscriptionDiagnostics<DTSubscriptionDiagnostics>;
}
export interface UASubscriptionDiagnosticsArray<T extends DTSubscriptionDiagnostics[]/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASubscriptionDiagnosticsArray_Base<T /*B*/> {
}