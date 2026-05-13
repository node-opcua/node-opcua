import type { Int32, UAString, UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTArgument } from "node-opcua-nodeset-ua/dist/dt_argument";

import type { DTWwMessageArgumentValue } from "./dt_ww_message_argument_value";

// ----- this file has been automatically generated - do not edit

/**
 * The WwArgumentDataType definition extends the
 * argument structure with an argument value.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Woodworking/                    |
 * | nodeClass |DataType                                                    |
 * | name      |WwMessageArgumentDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTWwMessageArgument extends DTArgument {
  name: UAString; // String ns=0;i=12
  dataType: NodeId; // NodeId ns=0;i=17
  valueRank: Int32; // Int32 ns=0;i=6
  arrayDimensions: UInt32[]; // UInt32 ns=0;i=7
  description: LocalizedText; // LocalizedText ns=0;i=21
  /** The variable contains the value of the argument*/
  value: DTWwMessageArgumentValue; // ExtensionObject ns=16;i=3002
}
export interface UDTWwMessageArgument extends ExtensionObject, DTWwMessageArgument {};