// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTProductId } from "./dt_product_id"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ProductDataType                                 |
 * | isAbstract|false                                             |
 */
export interface DTProduct extends DTStructure  {
/** Identification of the product used by the environment. This argument must not be empty.*/
  externalId: DTProductId; // ExtensionObject ns=4;i=3003
}