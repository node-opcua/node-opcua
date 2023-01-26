// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
export interface UASealingMaterial_hardener extends Omit<UABaseMaterial, "identifier"|"location"|"materialIdentifier"> { // Object
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
}
export interface UASealingMaterial_resin extends Omit<UABaseMaterial, "identifier"|"location"|"materialIdentifier"> { // Object
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:SealingMaterialType ns=13;i=1018               |
 * |isAbstract      |false                                             |
 */
export interface UASealingMaterial_Base extends UABaseMaterial_Base {
    addOnMaterial?: UABaseDataVariable<UAString, DataType.String>;
    hardener?: UASealingMaterial_hardener;
    mixingRatio: UAAnalogUnit<number, DataType.Double>;
    resin?: UASealingMaterial_resin;
}
export interface UASealingMaterial extends UABaseMaterial, UASealingMaterial_Base {
}