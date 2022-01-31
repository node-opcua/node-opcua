// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:BaseMaterialType ns=13;i=1006                  |
 * |isAbstract      |false                                             |
 */
export interface UABaseMaterial_Base {
    description?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    identifier?: UAProperty<UAString, /*z*/DataType.String>;
    location: UAProperty<UAString, /*z*/DataType.String>;
    materialIdentifier: UAProperty<UAString, /*z*/DataType.String>;
    weight?: UAAnalogUnit<number, /*z*/DataType.Double>;
    x?: UAAnalogUnit<number, /*z*/DataType.Double>;
    y?: UAAnalogUnit<number, /*z*/DataType.Double>;
    z?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
export interface UABaseMaterial extends UAObject, UABaseMaterial_Base {
}