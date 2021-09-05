// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |Annotation                                        |
 * | isAbstract|false                                             |
 */
export interface DTAnnotation extends DTStructure  {
  message: UAString; // String ns=0;i=12
  userName: UAString; // String ns=0;i=12
  annotationTime: Date; // DateTime ns=0;i=294
}