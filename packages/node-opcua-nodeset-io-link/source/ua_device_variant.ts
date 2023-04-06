// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:DeviceVariantType ns=17;i=1013                 |
 * |isAbstract      |false                                             |
 */
export interface UADeviceVariant_Base {
    "$description": UAProperty<LocalizedText, DataType.LocalizedText>;
    deviceIcon?: UABaseDataVariable<Buffer, DataType.ByteString>;
    deviceSymbol?: UABaseDataVariable<Buffer, DataType.ByteString>;
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
    productId: UAProperty<UAString, DataType.String>;
}
export interface UADeviceVariant extends UAObject, UADeviceVariant_Base {
}