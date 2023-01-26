// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UACncComponent, UACncComponent_Base } from "./ua_cnc_component"
import { EnumCncOperationMode } from "./enum_cnc_operation_mode"
import { EnumCncChannelProgramStatus } from "./enum_cnc_channel_program_status"
import { EnumCncChannelStatus } from "./enum_cnc_channel_status"
import { DTCncPosition } from "./dt_cnc_position"
import { UACncPositionVariable } from "./ua_cnc_position_variable"
export interface UACncChannel_actFeedrate<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncChannel_actJogIncrement<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncChannel_actOverride<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncChannel_cmdFeedrate<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncChannel_cmdOverride<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncChannel_dryRunFeed<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * CNC channel component.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncChannelType ns=11;i=1002                    |
 * |isAbstract      |false                                             |
 */
export interface UACncChannel_Base extends UACncComponent_Base {
   // PlaceHolder for $CncAxis$
   // PlaceHolder for $CncSpindle$
    /**
     * actFeedrate
     * Feedrate actual value.
     */
    actFeedrate: UACncChannel_actFeedrate<number, DataType.Double>;
    /**
     * actGFunctions
     * Array of active G functions; there can be several
     * G functions active at a time (modal and non-modal
     * G functions).
     */
    actGFunctions: UADataItem<UInt32[], DataType.UInt32>;
    /**
     * actJogIncrement
     * Active JOG increment.
     */
    actJogIncrement: UACncChannel_actJogIncrement<number, DataType.Double>;
    /**
     * actMainProgramFile
     * Path of active CNC main program.
     */
    actMainProgramFile: UADataItem<UAString, DataType.String>;
    /**
     * actMainProgramFileOffset
     * File offset of active CNC main program file.
     */
    actMainProgramFileOffset?: UADataItem<UInt32, DataType.UInt32>;
    /**
     * actMainProgramLine
     * Line number of active CNC main program.
     */
    actMainProgramLine?: UADataItem<UAString, DataType.String>;
    /**
     * actMainProgramName
     * Name of active CNC main program.
     */
    actMainProgramName: UADataItem<UAString, DataType.String>;
    /**
     * actMFunctions
     * Array of active M functions: there can be several
     * M functions active at a time (modal and non-modal
     * M functions).
     */
    actMFunctions: UADataItem<UInt32[], DataType.UInt32>;
    /**
     * actModalOffsetFunction
     * Active zero offset function.
     */
    actModalOffsetFunction: UADataItem<UInt32, DataType.UInt32>;
    /**
     * actOperationMode
     * Channel's active mode of operation.
     */
    actOperationMode: UADataItem<EnumCncOperationMode, DataType.Int32>;
    /**
     * actOverride
     * Axis override actual value.
     */
    actOverride: UACncChannel_actOverride<number, DataType.Double>;
    /**
     * actProgramBlock
     * Block of lines containing the previous, actual
     * and subsequent lines of a CNC part program.
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
    actProgramFileOffset?: UADataItem<UInt32, DataType.UInt32>;
    /**
     * actProgramLine
     * Line number of active CNC program (main or
     * subprogram).
     */
    actProgramLine?: UADataItem<UAString, DataType.String>;
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
     * actStatus
     * Active status of channel.
     */
    actStatus: UADataItem<EnumCncChannelStatus, DataType.Int32>;
    /**
     * blockMode
     * Block mode status (true in case of block mode is
     * active, else false).
     */
    blockMode: UADataItem<boolean, DataType.Boolean>;
    /**
     * cmdFeedrate
     * Feedrate setpoint value.
     */
    cmdFeedrate: UACncChannel_cmdFeedrate<number, DataType.Double>;
    /**
     * cmdOperationMode
     * Channel’s mode of operation setpoint value.
     */
    cmdOperationMode: UADataItem<EnumCncOperationMode, DataType.Int32>;
    /**
     * cmdOverride
     * Override setpoint value.
     */
    cmdOverride: UACncChannel_cmdOverride<number, DataType.Double>;
    /**
     * dryRunFeed
     * Test feedrate.
     */
    dryRunFeed: UACncChannel_dryRunFeed<number, DataType.Double>;
    /**
     * feedHold
     * Feed status (true in case of feed hold active,
     * else false).
     */
    feedHold: UADataItem<boolean, DataType.Boolean>;
    /**
     * id
     * Unique numeric channel identifier.
     */
    id: UAProperty<UInt32, DataType.UInt32>;
    /**
     * posTcpBcsA
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsA: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpBcsB
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsB: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpBcsC
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsC: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpBcsX
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsX: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpBcsY
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsY: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpBcsZ
     * Actual position of the tool center point in
     * machine’s Cartesian base coordinate system.
     */
    posTcpBcsZ: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsA
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsA: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsB
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsB: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsC
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsC: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsX
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsX: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsY
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsY: UACncPositionVariable<DTCncPosition>;
    /**
     * posTcpWcsZ
     * Actual position of the tool center point in
     * machine’s Cartesian workpiece coordinate system.
     */
    posTcpWcsZ: UACncPositionVariable<DTCncPosition>;
    /**
     * toolId
     * ID of active tool; returns zero if no tool is
     * present.
     */
    toolId: UADataItem<UInt32, DataType.UInt32>;
}
export interface UACncChannel extends UACncComponent, UACncChannel_Base {
}