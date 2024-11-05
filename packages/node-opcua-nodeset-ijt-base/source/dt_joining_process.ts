// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTJoiningProcessMeta } from "./dt_joining_process_meta"
/**
 * This structure provides the base container for
 * any joining process in a joining system. 
 * Note: This specification defines the meta data of
 * a JoiningProcess, and the actual content of the
 * Joining Process is application specific.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningProcessDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningProcess extends DTStructure {
  /** It is the meta data of the joining process.*/
  joiningProcessMetaData: DTJoiningProcessMeta; // ExtensionObject ns=18;i=3024
  /** It is the actual content of the joining process which is defined by JoiningProcessMetaData.Classification property.
Examples: Joining Program, Joining Job, etc.
Note: The content is application-specific and is not defined in this version of the specification.*/
  joiningProcessContent: VariantOptions[]; // Variant ns=0;i=0
}
export interface UDTJoiningProcess extends ExtensionObject, DTJoiningProcess {};