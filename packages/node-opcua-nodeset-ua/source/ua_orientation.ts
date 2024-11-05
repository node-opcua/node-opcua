// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTOrientation } from "./dt_orientation"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |OrientationType i=18779                                     |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTOrientation i=18811                                       |
 * |value rank      |-1                                                          |
 * |isAbstract      |true                                                        |
 */
export interface UAOrientation_Base<T extends DTOrientation>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    angleUnit?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UAOrientation<T extends DTOrientation> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAOrientation_Base<T> {
}