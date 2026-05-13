import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { EnumCoatingClass } from "./enum_coating_class";
import type { EnumSignificantSide } from "./enum_significant_side";
import type { EnumStructureAlignment } from "./enum_structure_alignment";
import type { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GlassType i=1011                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAGlass_Base extends UABaseMaterial_Base {
    absorption?: UAAnalogUnit<any, any>;
    coatingClass: UAProperty<EnumCoatingClass, DataType.Int32>;
    coatingEmessivity?: UAAnalogUnit<any, any>;
    coatingSubClass?: UAProperty<UAString, DataType.String>;
    electricalConductivity?: UAAnalogUnit<any, any>;
    orientation: UAProperty<any, any>;
    reflection?: UAAnalogUnit<any, any>;
    significantSide: UAProperty<EnumSignificantSide, DataType.Int32>;
    structureAlignment: UAProperty<EnumStructureAlignment, DataType.Int32>;
    structureClass: UAProperty<UAString, DataType.String>;
    transmission?: UAAnalogUnit<any, any>;
    x: UAAnalogUnit<number, DataType.Double>;
    y: UAAnalogUnit<number, DataType.Double>;
}
export interface UAGlass extends Omit<UABaseMaterial, "x"|"y">, UAGlass_Base {}