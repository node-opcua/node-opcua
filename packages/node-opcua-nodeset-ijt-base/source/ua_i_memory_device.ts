// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt64, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_identification"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
export interface UAIMemoryDevice_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * storageCapacity
       * StorageCapacity is the static information on size
       * of the storage in Bytes.
       */
      storageCapacity?: UABaseDataVariable<UInt64, DataType.UInt64>;
      /**
       * type
       * Type is the type of memory device. It may define
       * the form factor, interface, or technology.
       * Examples: Flash, CFAST, USB, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * usedSpace
       * UsedSpace is the static information on size of
       * the used space in Bytes.
       */
      usedSpace?: UABaseDataVariable<UInt64, DataType.UInt64>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IMemoryDeviceType i=1013                                    |
 * |isAbstract      |true                                                        |
 */
export interface UAIMemoryDevice_Base extends UAIJoiningSystemAsset_Base {
    /**
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting IJoiningSystemAssetType will replace
     * it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAMachineryItemIdentification;
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIMemoryDevice_parameters;
}
export interface UAIMemoryDevice extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIMemoryDevice_Base {
}