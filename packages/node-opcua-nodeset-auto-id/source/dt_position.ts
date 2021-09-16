// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:Position                                        |
 * | isAbstract|false                                             |
 */
export interface DTPosition extends DTStructure  {
  positionX: Int32; // Int32 ns=0;i=6
  positionY: Int32; // Int32 ns=0;i=6
  sizeX: Int32; // Int32 ns=0;i=6
  sizeY: Int32; // Int32 ns=0;i=6
  rotation: Int32; // Int32 ns=0;i=6
}