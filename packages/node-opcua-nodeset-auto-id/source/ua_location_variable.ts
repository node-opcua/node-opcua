// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTLocation } from "./dt_location"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |3:LocationVariableType ns=3;i=2002                |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTLocation ns=3;i=3008                            |
 * |isAbstract      |false                                             |
 */
export interface UALocationVariable_Base<T extends DTLocation>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    geographicalUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    lengthUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    rotationalUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    speedUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UALocationVariable<T extends DTLocation> extends UABaseDataVariable<T, DataType.ExtensionObject>, UALocationVariable_Base<T> {
}