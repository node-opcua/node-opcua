// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { Byte, UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAJoiningDataVariable } from "node-opcua-nodeset-ijt-base/source/ua_joining_data_variable"
/**
 * This interface is inherited from
 * 0:BaseInterfaceType to add additional parameters
 * of a tool in a tightening system. It shall be
 * added to 2:Parameters object of the tool instance.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Tightening/                 |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ITighteningToolParametersType i=1003                        |
 * |isAbstract      |true                                                        |
 */
export interface UAITighteningToolParameters_Base extends UABaseInterface_Base {
    /**
     * designType
     * DesignType provides information on the design of
     * the Tool.
     */
    designType: UAMultiStateDiscrete<Byte, DataType.Byte>;
    /**
     * driveMethod
     * DriveMethod provides information on the drive
     * method of the motor of the Tool.
     */
    driveMethod: UAMultiStateDiscrete<Byte, DataType.Byte>;
    /**
     * driveType
     * DriveType provides information on the drive type
     * of the Tool.
     */
    driveType: UAMultiStateDiscrete<Byte, DataType.Byte>;
    /**
     * maxSpeed
     * MaxSpeed is the maximum rotation speed of the
     * driving shaft.
     */
    maxSpeed?: UAJoiningDataVariable<number, DataType.Double>;
    /**
     * maxTorque
     * MaxTorque is the maximum allowed torque for which
     * the tool may be used for tightening processes.
     * For Click Wrenches, it may not be available.
     */
    maxTorque?: UAJoiningDataVariable<number, DataType.Double>;
    /**
     * minTorque
     * MinTorque is the minimum allowed torque for which
     * the tool may be used for tightening processes.
     */
    minTorque?: UAJoiningDataVariable<number, DataType.Double>;
    /**
     * motorType
     * MotorType is the type of motor in the tool.
     */
    motorType?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * shutOffMethod
     * ShutOffMethod provides information on the shutoff
     * method of the tool.
     */
    shutOffMethod?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
export interface UAITighteningToolParameters extends UABaseInterface, UAITighteningToolParameters_Base {
}