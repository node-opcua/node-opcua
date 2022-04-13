// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumServerState } from "./enum_server_state"
import { DTBuildInfo } from "./dt_build_info"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ServerStatusDataType                              |
 * | isAbstract|false                                             |
 */
export interface DTServerStatus extends DTStructure  {
  startTime: Date; // DateTime ns=0;i=294
  currentTime: Date; // DateTime ns=0;i=294
  state: EnumServerState; // Int32 ns=0;i=852
  buildInfo: DTBuildInfo; // ExtensionObject ns=0;i=338
  secondsTillShutdown: UInt32; // UInt32 ns=0;i=7
  shutdownReason: LocalizedText; // LocalizedText ns=0;i=21
}