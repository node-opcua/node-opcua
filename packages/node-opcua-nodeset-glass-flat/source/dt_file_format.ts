// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Glass/Flat/           |
 * | nodeClass |DataType                                          |
 * | name      |13:FileFormatType                                 |
 * | isAbstract|false                                             |
 */
export interface DTFileFormat extends DTStructure {
  name: UAString; // String ns=0;i=12
  fileExtension: UAString; // String ns=0;i=12
  version: UAString; // String ns=0;i=12
}