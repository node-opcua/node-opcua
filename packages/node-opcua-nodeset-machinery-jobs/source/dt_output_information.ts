// ----- this file has been automatically generated - do not edit
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |OutputInformationDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTOutputInformation extends DTStructure {
  /** ItemNumber defines an Identifier to identify the Type of the item (Material Identifier).*/
  itemNumber: UAString; // String ns=0;i=12
  /** Bitmask indicating which of the optional fields are used for identification. If none is selected, only ItemNumber is used. Each selected optional field shall provide a value.*/
  outputInfo: Byte; // Byte ns=10;i=3009
  /** OrderNumber defines an Identifier to identify the order. Shall be provided if defined in OutputInfo.*/
  orderNumber?: UAString; // String ns=0;i=12
  /** LotNumber defines an Identifier to identify the production-group of the item (Lot Identifier). Shall be provided if defined in OutputInfo.*/
  lotNumber?: UAString; // String ns=0;i=12
  /** SerialNumber defines an Identifier to identify the one entity of the item (Product Identifier). Shall be provided if defined in OutputInfo.*/
  serialNumber?: UAString; // String ns=0;i=12
}
export interface UDTOutputInformation extends ExtensionObject, DTOutputInformation {};