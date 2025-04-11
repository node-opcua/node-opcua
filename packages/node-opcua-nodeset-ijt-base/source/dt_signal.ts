// ----- this file has been automatically generated - do not edit
import { Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure contains the signal information
 * which is used in SetIOSignals and GetIOSignals
 * methods.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |SignalDataType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTSignal extends DTStructure {
  /** It is the identifier of the signal.*/
  signalId: UAString; // String ns=0;i=31918
  /** It is the value of the signal.*/
  signalValue: number; // Variant ns=0;i=26
  /** It is the description of the signal.*/
  signalDescription: UAString; // String ns=0;i=12
  /** It is the type of the signal.*/
  signalType: Int16; // Int16 ns=0;i=4
}
export interface UDTSignal extends ExtensionObject, DTSignal {};