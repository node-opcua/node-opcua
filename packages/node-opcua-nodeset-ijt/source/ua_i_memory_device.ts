// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt64, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIMemoryDevice_parameters extends UAFolder { // Object
      /**
       * storageCapacity
       * The optional StorageCapacity is the static
       * information on size of the storage in Bytes.
       */
      storageCapacity?: UABaseDataVariable<UInt64, DataType.UInt64>;
      /**
       * type
       * The optional Type is the type of memory device.
       * It may define the form factor, interface, or
       * technology. Examples: Flash, CFAST, USB, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * usedSpace
       * The optional UsedSpace is the static information
       * on size of the used space in Bytes.
       */
      usedSpace?: UABaseDataVariable<UInt64, DataType.UInt64>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IMemoryDeviceType ns=14;i=1013                 |
 * |isAbstract      |true                                              |
 */
export interface UAIMemoryDevice_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIMemoryDevice_parameters;
}
export interface UAIMemoryDevice extends UAITighteningSystemAsset, UAIMemoryDevice_Base {
}