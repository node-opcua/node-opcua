// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
export interface UASpacer_filling<T, DT extends DataType> extends UABaseDataVariable<T, /*b*/DT> { // Variable
      fillLevel: UAAnalogUnit<number, /*z*/DataType.Double>;
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
    filling?: UASpacer_filling<UAString, /*z*/DataType.String>;
    sealantDepth?: UAAnalogUnit<number, /*z*/DataType.Double>;
    spacerMaterialClass: UAProperty<any, any>;
    spacerMaterialSubClass?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UASpacer extends UABaseMaterial, UASpacer_Base {
}