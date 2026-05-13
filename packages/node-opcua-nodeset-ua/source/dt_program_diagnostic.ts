import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTArgument } from "./dt_argument";
import type { DTStatusResult } from "./dt_status_result";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ProgramDiagnosticDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTProgramDiagnostic extends DTStructure {
  createSessionId: NodeId; // NodeId ns=0;i=17
  createClientName: UAString; // String ns=0;i=12
  invocationCreationTime: Date; // DateTime ns=0;i=294
  lastTransitionTime: Date; // DateTime ns=0;i=294
  lastMethodCall: UAString; // String ns=0;i=12
  lastMethodSessionId: NodeId; // NodeId ns=0;i=17
  lastMethodInputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodOutputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodCallTime: Date; // DateTime ns=0;i=294
  lastMethodReturnStatus: DTStatusResult; // ExtensionObject ns=0;i=299
}
export interface UDTProgramDiagnostic extends ExtensionObject, DTProgramDiagnostic {};