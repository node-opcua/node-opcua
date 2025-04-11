// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FoilType i=1019                                             |
 * |isAbstract      |false                                                       |
 */
export interface UAFoil_Base extends UABaseMaterial_Base {
    z: UAAnalogUnit<number, DataType.Double>;
}
export interface UAFoil extends Omit<UABaseMaterial, "z">, UAFoil_Base {
}