import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Glass/Flat/                     |
 * | nodeClass |DataType                                                    |
 * | name      |FileFormatType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTFileFormat extends DTStructure {
  name: UAString; // String ns=0;i=12
  fileExtension: UAString; // String ns=0;i=12
  version: UAString; // String ns=0;i=12
}
export interface UDTFileFormat extends ExtensionObject, DTFileFormat {};