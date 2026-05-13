import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |Annotation                                                  |
 * | isAbstract|false                                                       |
 */
export interface DTAnnotation extends DTStructure {
  message: UAString; // String ns=0;i=12
  userName: UAString; // String ns=0;i=12
  annotationTime: Date; // DateTime ns=0;i=294
}
export interface UDTAnnotation extends ExtensionObject, DTAnnotation {};