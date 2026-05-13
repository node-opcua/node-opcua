import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material";

// ----- this file has been automatically generated - do not edit

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
export interface UAFoil extends Omit<UABaseMaterial, "z">, UAFoil_Base {}