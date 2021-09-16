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
export interface DTLocation extends DTUnion  {
  NMEA: UAString; // String ns=3;i=3012
  local: DTLocalCoordinate; // ExtensionObject ns=3;i=3019
  WGS84: DTWGS84Coordinate; // ExtensionObject ns=3;i=3027
  name: UAString; // String ns=3;i=3021
}