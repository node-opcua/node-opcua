// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:LocalCoordinate                                 |
 * | isAbstract|false                                             |
 */
export interface DTLocalCoordinate extends DTStructure  {
  x: number; // Double ns=0;i=11
  y: number; // Double ns=0;i=11
  z: number; // Double ns=0;i=11
/** Optional*/
  timestamp: Date; // DateTime ns=0;i=294
/** Optional*/
  dilutionOfPrecision: number; // Double ns=0;i=11
/** Optional*/
  usefulPrecision: Int32; // Int32 ns=0;i=6
}