// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |AlarmRateVariableType ns=0;i=17277                |
 * |dataType        |Double                                            |
 * |dataType Name   |number ns=0;i=11                                  |
 * |isAbstract      |false                                             |
 */
export interface UAAlarmRateVariable_Base<T extends number/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.Double> {
    rate: UAProperty<UInt16, /*z*/DataType.UInt16>;
}
export interface UAAlarmRateVariable<T extends number/*j*/> extends UABaseDataVariable<T, /*n*/DataType.Double>, UAAlarmRateVariable_Base<T /*B*/> {
}