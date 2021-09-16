// ----- this file has been automatically generated - do not edit
import { Int32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:AntennaNameIdPair                               |
 * | isAbstract|false                                             |
 */
export interface DTAntennaNameIdPair extends DTStructure  {
  antennaId: Int32; // Int32 ns=0;i=6
  antennaName: UAString; // String ns=0;i=12
}