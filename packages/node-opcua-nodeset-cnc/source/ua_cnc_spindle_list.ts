// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UACncSpindle, UACncSpindle_actSpeed, UACncSpindle_cmdSpeed } from "./ua_cnc_spindle"
import { EnumCncOperationMode } from "./enum_cnc_operation_mode"
import { EnumCncChannelProgramStatus } from "./enum_cnc_channel_program_status"
import { EnumCncSpindleStatus } from "./enum_cnc_spindle_status"
import { EnumCncSpindleTurnDirection } from "./enum_cnc_spindle_turn_direction"
import { DTCncPosition } from "./dt_cnc_position"
import { UACncPositionVariable } from "./ua_cnc_position_variable"
export interface UACncSpindleList_$CncSpindle$ extends Omit<UACncSpindle, "actChannel"|"actGear"|"actLoad"|"actOverride"|"actPower"|"actSpeed"|"actStatus"|"actTorque"|"actTurnDirection"|"anglePos"|"cmdGear"|"cmdOverride"|"cmdSpeed"|"cmdTorque"|"isInactive"|"isVirtual"> { // Object
      /**
       * actChannel
       * NodeId of the channel object (CncChannelType)
       * that administrates this drive to expose drive’s
       * channel affiliation.
       */
      actChannel: UADataItem<NodeId, DataType.NodeId>;
      /**
       * actFeedrate
       * Feedrate actual value.
       */
      actFeedrate: UAAnalogItem<number, DataType.Double>;
      /**
       * actGear
       * Gear stage actual value.
       */
      actGear: UADataItem<UInt32, DataType.UInt32>;
      /**
       * actGFunctions
       * Active G function.
       */
      actGFunctions: UADataItem<UInt32[], DataType.UInt32>;
      /**
       * actJogIncrement
       * Active JOG increment.
       */
      actJogIncrement: UAAnalogItem<number, DataType.Double>;
      /**
       * actLoad
       * Drive load actual value.
       */
      actLoad: UAAnalogItem<number, DataType.Double>;
      /**
       * actMainProgramFile
       * Path of active CNC main program.
       */
      actMainProgramFile: UADataItem<UAString, DataType.String>;
      /**
       * actMainProgramFileOffset
       * File offset of active CNC main program file.
       */
      actMainProgramFileOffset: UADataItem<UInt32, DataType.UInt32>;
      /**
       * actMainProgramLine
       * Line number of active CNC main program.
       */
      actMainProgramLine: UADataItem<UAString, DataType.String>;
      /**
       * actMainProgramName
       * Name of active CNC main program.
       */
      actMainProgramName: UADataItem<UAString, DataType.String>;
      /**
       * actMFunctions
       * Active M function.
       */
      actMFunctions: UADataItem<UInt32[], DataType.UInt32>;
      /**
       * actModalOffsetFunction
       * active zero offset function
       */
      actModalOffsetFunction: UADataItem<UInt32, DataType.UInt32>;
      actOperationMode: UADataItem<EnumCncOperationMode, DataType.Int32>;
      /**
       * actOverride
       * Override actual value.
       */
      actOverride: UAAnalogItem<number, DataType.Double>;
      /**
       * actPower
       * Drive power actual value.
       */
      actPower: UAAnalogItem<number, DataType.Double>;
      /**
       * actProgramBlock
       * previous, actual and subsequent CNC program lines
       */
      actProgramBlock: UADataItem<UAString[], DataType.String>;
      /**
       * actProgramFile
       * Path of active CNC program file (main or
       * subprogram).
       */
      actProgramFile: UADataItem<UAString, DataType.String>;
      /**
       * actProgramFileOffset
       * File offset of active CNC program file (main or
       * subprogram).
       */
      actProgramFileOffset: UADataItem<UInt32, DataType.UInt32>;
      /**
       * actProgramLine
       * Line number of active CNC program (main or
       * subprogram).
       */
      actProgramLine: UADataItem<UAString, DataType.String>;
      /**
       * actProgramName
       * Name of active CNC program (main or subprogram).
       */
      actProgramName: UADataItem<UAString, DataType.String>;
      /**
       * actProgramStatus
       * Active channel program status
       */
      actProgramStatus: UADataItem<EnumCncChannelProgramStatus, DataType.Int32>;
      /**
       * actSpeed
       * Speed actual value.
       */
      actSpeed: UACncSpindle_actSpeed<number, DataType.Double>;
      /**
       * actStatus
       * Actual spindle state.
       */
      actStatus: UADataItem<EnumCncSpindleStatus, DataType.Int32>;
      /**
       * actTorque
       * Drive torque actual value.
       */
      actTorque: UAAnalogItem<number, DataType.Double>;
      /**
       * actTurnDirection
       * Turn direction actual value.
       */
      actTurnDirection: UADataItem<EnumCncSpindleTurnDirection, DataType.Int32>;
      /**
       * anglePos
       * Spindle angular position values in case of
       * interpolated (position controlled) spindle
       * movement. Returns zeros in case of regular
       * spindle operation (velocity controlled).
       */
      anglePos: UACncPositionVariable<DTCncPosition>;
      /**
       * blockMode
       * block mode active
       */
      blockMode: UADataItem<boolean, DataType.Boolean>;
      /**
       * cmdFeedrate
       * feedrate setpoint value
       */
      cmdFeedrate: UAAnalogItem<number, DataType.Double>;
      /**
       * cmdGear
       * Gear stage setpoint value.
       */
      cmdGear: UADataItem<UInt32, DataType.UInt32>;
      cmdOperationMode: UADataItem<EnumCncOperationMode, DataType.Int32>;
      /**
       * cmdOverride
       * Override setpoint value.
       */
      cmdOverride: UAAnalogItem<number, DataType.Double>;
      /**
       * cmdSpeed
       * Speed setpoint value.
       */
      cmdSpeed: UACncSpindle_cmdSpeed<number, DataType.Double>;
      /**
       * cmdTorque
       * Drive torque setpoint value.
       */
      cmdTorque: UAAnalogItem<number, DataType.Double>;
      /**
       * dryRunFeed
       * test feedrate
       */
      dryRunFeed: UAAnalogItem<number, DataType.Double>;
      /**
       * feedHold
       * feed hold active
       */
      feedHold: UADataItem<boolean, DataType.Boolean>;
      /**
       * isInactive
       * Drive inactive state (true in case of inactive
       * drive, else false).
       */
      isInactive: UADataItem<boolean, DataType.Boolean>;
      /**
       * isVirtual
       * Virtual axis (no hardware present; true in case
       * of virtual axis, else fals).
       */
      isVirtual: UADataItem<boolean, DataType.Boolean>;
      /**
       * toolId
       * active tool ID
       */
      toolId: UADataItem<UInt32, DataType.UInt32>;
}
/**
 * List of CNC spindle objects.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncSpindleListType ns=11;i=1009                |
 * |isAbstract      |false                                             |
 */
export interface UACncSpindleList_Base {
   // PlaceHolder for $CncSpindle$
}
export interface UACncSpindleList extends UAObject, UACncSpindleList_Base {
}