import type { UAObject } from "node-opcua-address-space-base";
import type { Guid, Int32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KitchenDeviceParameterType i=1004                           |
 * |isAbstract      |true                                                        |
 */
export interface UAKitchenDeviceParameter_Base {
    programId?: UABaseDataVariable<Int32, DataType.Int32>;
    programName?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    programUId?: UABaseDataVariable<Guid, DataType.Guid>;
}
export interface UAKitchenDeviceParameter extends UAObject, UAKitchenDeviceParameter_Base {}