// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/               |
 * | nodeClass |DataType                                          |
 * | name      |15:PackMLRemoteInterfaceDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTPackMLRemoteInterface extends DTStructure {
  /** This is the unique number for the downstream/upstream unit machine using a common tag structure as the unit machine.*/
  number: Int32; // Int32 ns=0;i=6
  /** A user defined command number associated with coded value from a remote unit. This number is a coded value sent from one node on the network to another.*/
  controlCmdNumber: Int32; // Int32 ns=0;i=6
  /** This is the command value associated with the ControlCmdNumber above.*/
  cmdValue: Int32; // Int32 ns=0;i=6
  /** The parameter tags associated to commanded remote interface are typically used for command parameters that are given to the unit machine from remote machines.*/
  parameter: DTPackMLDescriptor[]; // ExtensionObject ns=15;i=16
}
export interface UDTPackMLRemoteInterface extends ExtensionObject, DTPackMLRemoteInterface {};