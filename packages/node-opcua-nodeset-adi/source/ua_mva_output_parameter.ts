// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumAlarmState } from "./enum_alarm_state"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MVAOutputParameterType i=2010                               |
 * |dataType        |Null                                                        |
 * |dataType Name   |(VariantOptions | VariantOptions[]) i=0                     |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMVAOutputParameter_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    warningLimits?: UAProperty<DTRange, DataType.ExtensionObject>;
    alarmLimits?: UAProperty<DTRange, DataType.ExtensionObject>;
    alarmState: UAProperty<EnumAlarmState, DataType.Int32>;
    vendorSpecificError?: UAProperty<UAString, DataType.String>;
   // PlaceHolder for statistics
}
export interface UAMVAOutputParameter<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAMVAOutputParameter_Base<T, DT> {
}