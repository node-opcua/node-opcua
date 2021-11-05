// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTArgument } from "./dt_argument"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ProgramDiagnostic2DataType                        |
 * | isAbstract|false                                             |
 */
export interface DTProgramDiagnostic2 extends DTStructure  {
  createSessionId: NodeId; // NodeId ns=0;i=17
  createClientName: UAString; // String ns=0;i=12
  invocationCreationTime: Date; // DateTime ns=0;i=294
  lastTransitionTime: Date; // DateTime ns=0;i=294
  lastMethodCall: UAString; // String ns=0;i=12
  lastMethodSessionId: NodeId; // NodeId ns=0;i=17
  lastMethodInputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodOutputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodInputValues: undefined[]; // Null ns=0;i=0
  lastMethodOutputValues: undefined[]; // Null ns=0;i=0
  lastMethodCallTime: Date; // DateTime ns=0;i=294
  lastMethodReturnStatus: StatusCode; // StatusCode ns=0;i=19
}