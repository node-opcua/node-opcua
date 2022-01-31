// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:FoilType ns=13;i=1019                          |
 * |isAbstract      |false                                             |
 */
export interface UAFoil_Base extends UABaseMaterial_Base {
    z: UAAnalogUnit<number, /*z*/DataType.Double>;
}
export interface UAFoil extends Omit<UABaseMaterial, "z">, UAFoil_Base {
}