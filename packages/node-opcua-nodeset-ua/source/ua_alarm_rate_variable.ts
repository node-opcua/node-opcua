// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AlarmRateVariableType i=17277                               |
 * |dataType        |Double                                                      |
 * |dataType Name   |number i=11                                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAlarmRateVariable_Base<T extends number>  extends UABaseDataVariable_Base<T, DataType.Double> {
    rate: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAAlarmRateVariable<T extends number> extends UABaseDataVariable<T, DataType.Double>, UAAlarmRateVariable_Base<T> {
}