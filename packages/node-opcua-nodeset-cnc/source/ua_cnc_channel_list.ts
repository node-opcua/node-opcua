// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTCncPosition } from "./dt_cnc_position"
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
}
export interface UACncChannelList extends UAObject, UACncChannelList_Base {
}