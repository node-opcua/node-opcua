// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:KitchenDeviceParameterType ns=5;i=1004          |
 * |isAbstract      |true                                              |
 */
export interface UAKitchenDeviceParameter_Base {
    programId?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    programName?: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    programUId?: UABaseDataVariable<Guid, /*z*/DataType.Guid>;
}
export interface UAKitchenDeviceParameter extends UAObject, UAKitchenDeviceParameter_Base {
}