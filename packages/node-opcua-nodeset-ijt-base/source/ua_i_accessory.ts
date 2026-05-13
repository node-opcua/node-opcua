import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

export interface UAIAccessory_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is a user readable open string to describe
       * the type of accessory such as socket selector,
       * operator panel, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAccessoryType i=1015                                       |
 * |isAbstract      |true                                                        |
 */
export interface UAIAccessory_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIAccessory_parameters;
}
export interface UAIAccessory extends Omit<UAIJoiningSystemAsset, "parameters">, UAIAccessory_Base {}