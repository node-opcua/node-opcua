// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTCartesianCoordinates } from "./dt_cartesian_coordinates"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |CartesianCoordinatesType ns=0;i=18772             |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTCartesianCoordinates ns=0;i=18809               |
 * |isAbstract      |true                                              |
 */
export interface UACartesianCoordinates_Base<T extends DTCartesianCoordinates/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    lengthUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UACartesianCoordinates<T extends DTCartesianCoordinates/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UACartesianCoordinates_Base<T /*B*/> {
}