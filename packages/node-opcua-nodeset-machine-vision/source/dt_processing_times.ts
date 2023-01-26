// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ProcessingTimesDataType                         |
 * | isAbstract|false                                             |
 */
export interface DTProcessingTimes extends DTStructure {
  /** Contains the time when the vision system started execution of the recipe.*/
  startTime: Date; // DateTime ns=0;i=294
  /** Contains the time when the vision system finished (or stopped/aborted) execution of the recipe.*/
  endTime: Date; // DateTime ns=0;i=294
  /** Time spent by the vision system acquiring images.*/
  acquisitionDuration?: number; // Double ns=0;i=290
  /** Time spent by the vision system processing data.*/
  processingDuration?: number; // Double ns=0;i=290
}
export interface UDTProcessingTimes extends ExtensionObject, DTProcessingTimes {};