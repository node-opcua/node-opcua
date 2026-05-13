import type { UAString, UInt64 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

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
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIMemoryDevice_parameters;
}
export interface UAIMemoryDevice extends Omit<UAIJoiningSystemAsset, "parameters">, UAIMemoryDevice_Base {}