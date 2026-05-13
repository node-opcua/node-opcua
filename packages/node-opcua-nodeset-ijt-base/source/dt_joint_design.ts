import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTDesignValue } from "./dt_design_value";

// ----- this file has been automatically generated - do not edit

/**
 * This structure provides the design information of
 * a given joint.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JointDesignDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTJointDesign extends DTStructure {
  /** It is the identifier of the joint design.*/
  jointDesignId: UAString; // String ns=0;i=31918
  /** It is the name of the joint design.*/
  name?: UAString; // String ns=0;i=12
  /** It is the description of the joint design.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the list of design values.*/
  jointDesignContent?: DTDesignValue[]; // ExtensionObject ns=18;i=3015
  /** It is the list of joint components associated to the joint design.
Examples: BoltId, RivetId, GasketId, etc.*/
  jointComponentIdList?: UAString[]; // String ns=0;i=31918
}
export interface UDTJointDesign extends ExtensionObject, DTJointDesign {};