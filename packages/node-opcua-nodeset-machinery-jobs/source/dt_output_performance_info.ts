// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTISA95Parameter } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/source/dt_isa_95_parameter"
import { DTOutputInformation } from "./dt_output_information"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |OutputPerformanceInfoDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTOutputPerformanceInfo extends DTStructure {
  /** Identification of the output.*/
  identification: DTOutputInformation; // ExtensionObject ns=10;i=3012
  /** Output of first item from order.*/
  startTime?: Date; // DateTime ns=0;i=13
  /** Output of last item from order.*/
  endTime?: Date; // DateTime ns=0;i=13
  /** Parameters specific to the performance like pressure or temperature.*/
  parameters: DTISA95Parameter[]; // ExtensionObject ns=9;i=3003
}
export interface UDTOutputPerformanceInfo extends ExtensionObject, DTOutputPerformanceInfo {};