// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { EnumSpacerMaterialClass } from "./enum_spacer_material_class"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
export interface UASpacer_filling<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      fillLevel: UAAnalogUnit<number, DataType.Double>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:SpacerType ns=13;i=1016                        |
 * |isAbstract      |false                                             |
 */
export interface UASpacer_Base extends UABaseMaterial_Base {
    filling?: UASpacer_filling<UAString, DataType.String>;
    sealantDepth?: UAAnalogUnit<number, DataType.Double>;
    spacerMaterialClass: UAProperty<EnumSpacerMaterialClass, DataType.Int32>;
    spacerMaterialSubClass?: UAProperty<UAString, DataType.String>;
}
export interface UASpacer extends UABaseMaterial, UASpacer_Base {
}