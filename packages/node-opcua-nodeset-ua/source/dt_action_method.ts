import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ActionMethodDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTActionMethod extends DTStructure {
  objectId: NodeId; // NodeId ns=0;i=17
  methodId: NodeId; // NodeId ns=0;i=17
}
export interface UDTActionMethod extends ExtensionObject, DTActionMethod {};