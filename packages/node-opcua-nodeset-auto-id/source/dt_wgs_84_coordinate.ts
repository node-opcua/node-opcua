// ----- this file has been automatically generated - do not edit
import { Int32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:WGS84Coordinate                                 |
 * | isAbstract|false                                             |
 */
export interface DTWGS84Coordinate extends DTStructure  {
  "n/S_Hemisphere": UAString; // String ns=0;i=12
  latitude: number; // Double ns=0;i=11
  "e/W_Hemisphere": UAString; // String ns=0;i=12
  longitude: number; // Double ns=0;i=11
  altitude: number; // Double ns=0;i=11
  timestamp: Date; // DateTime ns=0;i=294
  dilutionOfPrecision: number; // Double ns=0;i=11
  usefulPrecisionLatLon: Int32; // Int32 ns=0;i=6
  usefulPrecisionAlt: Int32; // Int32 ns=0;i=6
}