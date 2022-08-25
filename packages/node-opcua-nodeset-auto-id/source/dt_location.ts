// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTUnion } from "node-opcua-nodeset-ua/source/dt_union"
import { DTLocalCoordinate } from "./dt_local_coordinate"
import { DTWGS84Coordinate } from "./dt_wgs_84_coordinate"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:Location                                        |
 * | isAbstract|false                                             |
 */
export interface DTLocation_0 extends DTUnion {
  NMEA: UAString; // String ns=3;i=3012
  local?: never
  WGS84?: never
  name?: never
}
export interface DTLocation_1 extends DTUnion {
  NMEA?: never
  local: DTLocalCoordinate; // ExtensionObject ns=3;i=3019
  WGS84?: never
  name?: never
}
export interface DTLocation_2 extends DTUnion {
  NMEA?: never
  local?: never
  WGS84: DTWGS84Coordinate; // ExtensionObject ns=3;i=3027
  name?: never
}
export interface DTLocation_3 extends DTUnion {
  NMEA?: never
  local?: never
  WGS84?: never
  name: UAString; // String ns=3;i=3021
}
export type DTLocation = 
  | DTLocation_0
  | DTLocation_1
  | DTLocation_2
  | DTLocation_3
  ;