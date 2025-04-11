// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure is the base container for any
 * joint component such as Bolt, Rivet, Gasket, Glue
 * string, etc. 
 * Note: The concrete definition of joint component
 * is not defined in this version of the
 * specification.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JointComponentDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTJointComponent extends DTStructure {
  /** It is the identifier of the joint component.
Examples: BoltId, RivetId, GasketId, etc.*/
  jointComponentId: UAString; // String ns=0;i=31918
  /** It is the name of the joint component.*/
  name?: UAString; // String ns=0;i=12
  /** It is the description of the joint component.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the manufacturer of the joint component.*/
  manufacturer?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the identifier of the manufacturer.*/
  manufacturerUri?: UAString; // String ns=0;i=12
  /** It is the content of the joint component.
Examples: Bolt, Rivet, Gasket, etc.*/
  jointComponentContent?: VariantOptions; // Variant ns=0;i=0
}
export interface UDTJointComponent extends ExtensionObject, DTJointComponent {};