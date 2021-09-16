// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ProductIdDataType                               |
 * | isAbstract|false                                             |
 */
export interface DTProductId extends DTStructure  {
/** Id is a system-wide unique identifier/name for identifying the product.*/
  id: UAString; // String ns=4;i=3017
/** Optional short human readable description of the configuration*/
  description: LocalizedText; // LocalizedText ns=0;i=21
}