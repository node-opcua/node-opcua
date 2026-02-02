// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NameValuePair                                               |
 * | isAbstract|false                                                       |
 */
export interface DTNameValuePair extends DTStructure {
  name: UAString; // String ns=0;i=12
  value: VariantOptions; // Variant ns=0;i=0
}
export interface UDTNameValuePair extends ExtensionObject, DTNameValuePair {};