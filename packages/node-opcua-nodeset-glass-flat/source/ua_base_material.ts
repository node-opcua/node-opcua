import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseMaterialType i=1006                                     |
 * |isAbstract      |false                                                       |
 */
export interface UABaseMaterial_Base {
    "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
    identifier?: UAProperty<UAString, DataType.String>;
    location: UAProperty<UAString, DataType.String>;
    materialIdentifier: UAProperty<UAString, DataType.String>;
    weight?: UAAnalogUnit<number, DataType.Double>;
    x?: UAAnalogUnit<number, DataType.Double>;
    y?: UAAnalogUnit<number, DataType.Double>;
    z?: UAAnalogUnit<number, DataType.Double>;
}
export interface UABaseMaterial extends UAObject, UABaseMaterial_Base {}