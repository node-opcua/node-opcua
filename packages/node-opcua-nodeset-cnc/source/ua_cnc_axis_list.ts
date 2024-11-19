// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumCncAxisStatus } from "./enum_cnc_axis_status"
import { DTCncPosition } from "./dt_cnc_position"
/**
 * List of CNC axis objects.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CncAxisListType i=1008                                      |
 * |isAbstract      |false                                                       |
 */
export interface UACncAxisList_Base {
   // PlaceHolder for $CncAxis$
}
export interface UACncAxisList extends UAObject, UACncAxisList_Base {
}