import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

export interface UAISubComponent_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is a user readable open string to describe
       * the type of subcomponent such as network module,
       * etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISubComponentType i=1016                                    |
 * |isAbstract      |true                                                        |
 */
export interface UAISubComponent_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters?: UAISubComponent_parameters;
}
export interface UAISubComponent extends Omit<UAIJoiningSystemAsset, "parameters">, UAISubComponent_Base {}