// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int16 } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIServo_parameters extends UAFolder { // Object
      /**
       * nodeNumber
       * The optional NodeNumber is the node identifier in
       * multiple configurations, e.g. cabinet with one
       * controller and multiple servo/tightening modules.
       */
      nodeNumber?: UABaseDataVariable<Int16, DataType.Int16>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IServoType ns=14;i=1008                        |
 * |isAbstract      |true                                              |
 */
export interface UAIServo_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIServo_parameters;
}
export interface UAIServo extends UAITighteningSystemAsset, UAIServo_Base {
}