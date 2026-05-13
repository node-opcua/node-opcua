import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DeviceVariantType i=1013                                    |
 * |isAbstract      |false                                                       |
 */
export interface UADeviceVariant_Base {
    "$description": UAProperty<LocalizedText, DataType.LocalizedText>;
    deviceIcon?: UABaseDataVariable<Buffer, DataType.ByteString>;
    deviceSymbol?: UABaseDataVariable<Buffer, DataType.ByteString>;
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
    productId: UAProperty<UAString, DataType.String>;
}
export interface UADeviceVariant extends UAObject, UADeviceVariant_Base {}