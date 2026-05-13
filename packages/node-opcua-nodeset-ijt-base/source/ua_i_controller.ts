import type { Byte } from "node-opcua-basic-types";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

export interface UAIController_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is the classification of a Controller.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IControllerType i=1003                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIController_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIController_parameters;
}
export interface UAIController extends Omit<UAIJoiningSystemAsset, "parameters">, UAIController_Base {}