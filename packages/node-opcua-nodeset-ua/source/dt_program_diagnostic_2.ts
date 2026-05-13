import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";
import type { Variant } from "node-opcua-variant";

import type { DTArgument } from "./dt_argument";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ProgramDiagnostic2DataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTProgramDiagnostic2 extends DTStructure {
  createSessionId: NodeId; // NodeId ns=0;i=17
  createClientName: UAString; // String ns=0;i=12
  invocationCreationTime: Date; // DateTime ns=0;i=294
  lastTransitionTime: Date; // DateTime ns=0;i=294
  lastMethodCall: UAString; // String ns=0;i=12
  lastMethodSessionId: NodeId; // NodeId ns=0;i=17
  lastMethodInputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodOutputArguments: DTArgument[]; // ExtensionObject ns=0;i=296
  lastMethodInputValues: Variant[]; // Variant ns=0;i=24
  lastMethodOutputValues: Variant[]; // Variant ns=0;i=24
  lastMethodCallTime: Date; // DateTime ns=0;i=294
  lastMethodReturnStatus: StatusCode; // StatusCode ns=0;i=19
}
export interface UDTProgramDiagnostic2 extends ExtensionObject, DTProgramDiagnostic2 {};