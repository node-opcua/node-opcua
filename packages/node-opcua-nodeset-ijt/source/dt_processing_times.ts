// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * This structure contains measured times that were
 * generated during the execution of a joining
 * process. These measured values provide
 * information about the duration required by the
 * various sub-functions.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:ProcessingTimesDataType                        |
 * | isAbstract|false                                             |
 */
export interface DTProcessingTimes extends DTStructure {
/** Contains the time when the system started execution of the joining process.*/
  startTime: Date; // DateTime ns=0;i=294
/** Contains the time when the system finished (or stopped/aborted) execution of joining process.*/
  endTime: Date; // DateTime ns=0;i=294
/** Time spent by the joining system collecting required information.*/
  acquisitionDuration: number; // Double ns=0;i=290
/** Time spent by the joining system processing data.*/
  processingDuration: number; // Double ns=0;i=290
}