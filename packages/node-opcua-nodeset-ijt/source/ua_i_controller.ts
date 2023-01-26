// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIController_parameters extends UAFolder { // Object
      /**
       * type
       * The optional Type is the classification of a
       * Controller.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IControllerType ns=14;i=1003                   |
 * |isAbstract      |true                                              |
 */
export interface UAIController_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIController_parameters;
}
export interface UAIController extends UAITighteningSystemAsset, UAIController_Base {
}