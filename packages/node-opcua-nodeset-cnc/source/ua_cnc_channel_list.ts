// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumCncAxisStatus } from "./enum_cnc_axis_status"
import { DTCncPosition } from "./dt_cnc_position"
import { EnumCncSpindleStatus } from "./enum_cnc_spindle_status"
import { EnumCncSpindleTurnDirection } from "./enum_cnc_spindle_turn_direction"
import { EnumCncOperationMode } from "./enum_cnc_operation_mode"
import { EnumCncChannelProgramStatus } from "./enum_cnc_channel_program_status"
import { EnumCncChannelStatus } from "./enum_cnc_channel_status"
/**
 * List of CNC channel objects.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncChannelListType ns=11;i=1010                |
 * |isAbstract      |false                                             |
 */
export interface UACncChannelList_Base {
   // PlaceHolder for $CncChannel$
}
export interface UACncChannelList extends UAObject, UACncChannelList_Base {
}