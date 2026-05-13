import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumSpacerMaterialClass } from "./enum_spacer_material_class";
import type { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material";

// ----- this file has been automatically generated - do not edit

export interface UASpacer_filling<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      fillLevel: UAAnalogUnit<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SpacerType i=1016                                           |
 * |isAbstract      |false                                                       |
 */
export interface UASpacer_Base extends UABaseMaterial_Base {
    filling?: UASpacer_filling<UAString, DataType.String>;
    sealantDepth?: UAAnalogUnit<number, DataType.Double>;
    spacerMaterialClass: UAProperty<EnumSpacerMaterialClass, DataType.Int32>;
    spacerMaterialSubClass?: UAProperty<UAString, DataType.String>;
}
export interface UASpacer extends UABaseMaterial, UASpacer_Base {}