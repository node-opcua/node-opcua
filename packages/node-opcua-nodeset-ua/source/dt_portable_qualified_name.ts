import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PortableQualifiedName                                       |
 * | isAbstract|false                                                       |
 */
export interface DTPortableQualifiedName extends DTStructure {
  namespaceUri: UAString; // String ns=0;i=12
  name: UAString; // String ns=0;i=12
}
export interface UDTPortableQualifiedName extends ExtensionObject, DTPortableQualifiedName {};