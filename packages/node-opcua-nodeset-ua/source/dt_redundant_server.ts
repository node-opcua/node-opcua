import type { Byte, UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumServerState } from "./enum_server_state";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |RedundantServerDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTRedundantServer extends DTStructure {
  serverId: UAString; // String ns=0;i=12
  serviceLevel: Byte; // Byte ns=0;i=3
  serverState: EnumServerState; // Int32 ns=0;i=852
}
export interface UDTRedundantServer extends ExtensionObject, DTRedundantServer {};