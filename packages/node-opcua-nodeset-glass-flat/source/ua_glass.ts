// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:GlassType ns=13;i=1011                         |
 * |isAbstract      |false                                             |
 */
export interface UAGlass_Base extends UABaseMaterial_Base {
    absorption?: UAAnalogUnit<any, any>;
    coatingClass: UAProperty<any, any>;
    coatingEmessivity?: UAAnalogUnit<any, any>;
    coatingSubClass?: UAProperty<UAString, /*z*/DataType.String>;
    electricalConductivity?: UAAnalogUnit<any, any>;
    orientation: UAProperty<any, any>;
    reflection?: UAAnalogUnit<any, any>;
    significantSide: UAProperty<any, any>;
    structureAlignment: UAProperty<any, any>;
    structureClass: UAProperty<UAString, /*z*/DataType.String>;
    transmission?: UAAnalogUnit<any, any>;
    x: UAAnalogUnit<number, /*z*/DataType.Double>;
    y: UAAnalogUnit<number, /*z*/DataType.Double>;
}
export interface UAGlass extends Omit<UABaseMaterial, "x"|"y">, UAGlass_Base {
}