// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, Int32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTWwMessageArgumentValue } from "./dt_ww_message_argument_value"
/**
 * The WwArgumentDataType definition extends the
 * argument structure with an argument value.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Woodworking/          |
 * | nodeClass |DataType                                          |
 * | name      |12:WwMessageArgumentDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTWwMessageArgument extends DTArgument {
  name: UAString; // String ns=0;i=12
  dataType: NodeId; // NodeId ns=0;i=17
  valueRank: Int32; // Int32 ns=0;i=6
  arrayDimensions: UInt32[]; // UInt32 ns=0;i=7
  description: LocalizedText; // LocalizedText ns=0;i=21
  /** The variable contains the value of the argument*/
  value: DTWwMessageArgumentValue; // ExtensionObject ns=12;i=3002
}
export interface UDTWwMessageArgument extends ExtensionObject, DTWwMessageArgument {};