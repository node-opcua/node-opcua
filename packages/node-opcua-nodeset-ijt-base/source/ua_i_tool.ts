import type { Byte } from "node-opcua-basic-types";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

export interface UAITool_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is the classification of a Tool.
       */
      type: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IToolType i=1004                                            |
 * |isAbstract      |true                                                        |
 */
export interface UAITool_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAITool_parameters;
}
export interface UAITool extends Omit<UAIJoiningSystemAsset, "parameters">, UAITool_Base {}