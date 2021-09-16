// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |10:ToolLifeType ns=10;i=61                        |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAToolLife_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T/*g*/, DT> {
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    indication: UAProperty<any, any>;
    isCountingUp: UAProperty<boolean, /*z*/DataType.Boolean>;
    limitValue?: UAProperty<any, any>;
    startValue?: UAProperty<any, any>;
    warningValue?: UAProperty<any, any>;
}
export interface UAToolLife<T, DT extends DataType> extends UABaseDataVariable<T, /*m*/DT>, UAToolLife_Base<T, DT /*A*/> {
}