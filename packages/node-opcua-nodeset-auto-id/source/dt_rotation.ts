// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:Rotation                                        |
 * | isAbstract|false                                             |
 */
export interface DTRotation extends DTStructure  {
  yaw: number; // Double ns=0;i=11
  pitch: number; // Double ns=0;i=11
  roll: number; // Double ns=0;i=11
}