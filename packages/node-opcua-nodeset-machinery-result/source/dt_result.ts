// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTResultMeta } from "./dt_result_meta"
/**
 * Contains fields that were created during the
 * execution of a recipe.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/               |
 * | nodeClass |DataType                                                    |
 * | name      |ResultDataType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTResult extends DTStructure {
  /** Contains meta data describing the resultContent.*/
  resultMetaData?: DTResultMeta; // ExtensionObject ns=11;i=3007
  /** Abstract data type to be subtyped from to hold result data created by the selected recipe.*/
  resultContent: VariantOptions[]; // Variant ns=0;i=0
}
export interface UDTResult extends ExtensionObject, DTResult {};