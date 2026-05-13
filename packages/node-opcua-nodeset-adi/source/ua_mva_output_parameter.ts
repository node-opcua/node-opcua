import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumAlarmState } from "./enum_alarm_state";

// ----- this file has been automatically generated - do not edit

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
export interface UAMVAOutputParameter<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAMVAOutputParameter_Base<T, DT> {}