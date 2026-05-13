import type { Byte } from "node-opcua-basic-types";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";
import type { UAJoiningDataVariable } from "./ua_joining_data_variable";

// ----- this file has been automatically generated - do not edit

export interface UAICable_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * cableLength
       * CableLength is the length of the cable.
       */
      cableLength?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * type
       * Type is the classification of the cable.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ICableType i=1014                                           |
 * |isAbstract      |true                                                        |
 */
export interface UAICable_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAICable_parameters;
}
export interface UAICable extends Omit<UAIJoiningSystemAsset, "parameters">, UAICable_Base {}