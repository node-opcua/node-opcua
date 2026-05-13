import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTProductId } from "./dt_product_id";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |ProductDataType                                             |
 * | isAbstract|false                                                       |
 */
export interface DTProduct extends DTStructure {
  /** Identification of the product used by the environment. This argument must not be empty.*/
  externalId: DTProductId; // ExtensionObject ns=4;i=3003
}
export interface UDTProduct extends ExtensionObject, DTProduct {};