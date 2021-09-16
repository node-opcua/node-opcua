// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |2:MVAOutputParameterType ns=2;i=2010              |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |false                                             |
 */
export interface UAMVAOutputParameter_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T/*g*/, DT> {
    warningLimits?: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    alarmLimits?: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    alarmState: UAProperty<any, any>;
    vendorSpecificError?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAMVAOutputParameter<T, DT extends DataType> extends UABaseDataVariable<T, /*m*/DT>, UAMVAOutputParameter_Base<T, DT /*A*/> {
}