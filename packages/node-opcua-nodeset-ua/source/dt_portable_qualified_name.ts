// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PortableQualifiedName                             |
 * | isAbstract|false                                             |
 */
export interface DTPortableQualifiedName extends DTStructure  {
  namespaceUri: UAString; // String ns=0;i=12
  name: UAString; // String ns=0;i=12
}