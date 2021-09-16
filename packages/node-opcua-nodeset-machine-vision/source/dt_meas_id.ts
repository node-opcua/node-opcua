// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:MeasIdDataType                                  |
 * | isAbstract|false                                             |
 */
export interface DTMeasId extends DTStructure  {
/** Id is an identifier/name for identifying the measurement operation. This identifier is passed by the client to the vision system so no assumptions can be made about its uniqueness or other properties.*/
  id: UAString; // String ns=4;i=3017
/** Optional short human readable description of the measurement.*/
  description: LocalizedText; // LocalizedText ns=0;i=21
}