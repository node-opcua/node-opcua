// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { DTLocation } from "./dt_location"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |LocationVariableType i=2002                                 |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTLocation i=3008                                           |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UALocationVariable_Base<T extends DTLocation>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    geographicalUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    lengthUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    rotationalUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
    speedUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UALocationVariable<T extends DTLocation> extends UABaseDataVariable<T, DataType.ExtensionObject>, UALocationVariable_Base<T> {
}