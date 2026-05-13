import type { Int16 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

export interface UAIServo_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * nodeNumber
       * NodeNumber is the node identifier in multiple
       * configurations. Examples: Cabinet with one
       * controller and multiple servo/modules.
       */
      nodeNumber?: UABaseDataVariable<Int16, DataType.Int16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IServoType i=1008                                           |
 * |isAbstract      |true                                                        |
 */
export interface UAIServo_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIServo_parameters;
}
export interface UAIServo extends Omit<UAIJoiningSystemAsset, "parameters">, UAIServo_Base {}