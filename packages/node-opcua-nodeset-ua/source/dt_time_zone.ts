// ----- this file has been automatically generated - do not edit
import { Int16 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TimeZoneDataType                                  |
 * | isAbstract|false                                             |
 */
export interface DTTimeZone extends DTStructure  {
  offset: Int16; // Int16 ns=0;i=4
  daylightSavingInOffset: boolean; // Boolean ns=0;i=1
}