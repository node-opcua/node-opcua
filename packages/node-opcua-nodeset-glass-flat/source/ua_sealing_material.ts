import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SealingMaterialType i=1018                                  |
 * |isAbstract      |false                                                       |
 */
export interface UASealingMaterial_Base extends UABaseMaterial_Base {
    addOnMaterial?: UABaseDataVariable<UAString, DataType.String>;
    hardener?: UASealingMaterial_hardener;
    mixingRatio: UAAnalogUnit<number, DataType.Double>;
    resin?: UASealingMaterial_resin;
}
export interface UASealingMaterial extends UABaseMaterial, UASealingMaterial_Base {}