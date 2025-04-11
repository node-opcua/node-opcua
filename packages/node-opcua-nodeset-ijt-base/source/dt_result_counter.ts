// ----- this file has been automatically generated - do not edit
import { UInt32, Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure is used to provide various types
 * of counters associated to a Result. These
 * counters are related to a joining process with
 * sub-processes.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |ResultCounterDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTResultCounter extends DTStructure {
  /** It is the name of the counter.*/
  name?: UAString; // String ns=0;i=12
  /** It is the value of the counter.*/
  counterValue: UInt32; // UInt32 ns=0;i=7
  /** It is the type of the Counter.*/
  counterType: Int16; // Int16 ns=0;i=4
}
export interface UDTResultCounter extends ExtensionObject, DTResultCounter {};