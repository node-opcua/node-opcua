import type { Byte } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTDataTypeDescription } from "./dt_data_type_description";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SimpleTypeDescription                                       |
 * | isAbstract|false                                                       |
 */
export interface DTSimpleTypeDescription extends DTDataTypeDescription {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
  baseDataType: NodeId; // NodeId ns=0;i=17
  builtInType: Byte; // Byte ns=0;i=3
}
export interface UDTSimpleTypeDescription extends ExtensionObject, DTSimpleTypeDescription {};