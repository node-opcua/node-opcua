// ----- this file has been automatically generated - do not edit
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |OptionSet                                         |
 * | isAbstract|true                                              |
 */
export interface DTOptionSet extends DTStructure  {
  value: Buffer; // ByteString ns=0;i=15
  validBits: Buffer; // ByteString ns=0;i=15
}