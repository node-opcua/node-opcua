// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32, Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAITool_parameters extends UAFolder { // Object
      /**
       * designType
       * The mandatory DesignType provides information on
       * the design of the Tool.
       */
      designType: UAMultiStateDiscrete<Byte, DataType.Byte>;
      /**
       * driveMethod
       * The mandatory DriveMethod provides information on
       * the drive method of the motor of the Tool.
       */
      driveMethod: UAMultiStateDiscrete<Byte, DataType.Byte>;
      /**
       * driveType
       * The mandatory DriveType provides information on
       * the drive type of the Tool.
       */
      driveType: UAMultiStateDiscrete<Byte, DataType.Byte>;
      /**
       * maxSpeed
       * The optional MaxSpeed is the maximum rotation
       * speed of the driving shaft.
       */
      maxSpeed?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * maxTorque
       * The mandatory MaxTorque is the maximum allowed
       * torque for which the tool may be used for
       * tightening processes. For Click Wrenches, it may
       * not be available.
       */
      maxTorque: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * minTorque
       * The optional MinTorque is the minimum allowed
       * torque for which the tool may be used for
       * tightening processes.
       */
      minTorque?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * motorType
       * The optional MotorType is the type of motor in
       * the tool.
       */
      motorType?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * shutOffMethod
       * The optional ShutOffMethod provides information
       * on the shutoff method of the tool.
       */
      shutOffMethod?: UAMultiStateDiscrete<Byte, DataType.Byte>;
      /**
       * totalNumberOfTightenings
       * The optional TotalNumberOfTightenings is the
       * total number of tightenings executed by the tool.
       * It is incremented by 1 to capture total number of
       * tightenings.
       */
      totalNumberOfTightenings?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * totalNumberOfTighteningsSinceService
       * The optional TotalNumberOfTighteningsSinceService
       * is the total number of tightenings executed by
       * the tool since the last service of the tool.
       */
      totalNumberOfTighteningsSinceService?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * type
       * The mandatory Type is the classification of a
       * Tool.
       */
      type: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IToolType ns=14;i=1004                         |
 * |isAbstract      |true                                              |
 */
export interface UAITool_Base extends UAITighteningSystemAsset_Base {
    parameters: UAITool_parameters;
}
export interface UAITool extends UAITighteningSystemAsset, UAITool_Base {
}