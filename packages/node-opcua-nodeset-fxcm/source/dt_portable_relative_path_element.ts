import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTPortableNodeId } from "node-opcua-nodeset-ua/dist/dt_portable_node_id.js";
import type { DTPortableQualifiedName } from "node-opcua-nodeset-ua/dist/dt_portable_qualified_name.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PortableRelativePathElement                                 |
 * | isAbstract|false                                                       |
 */
export interface DTPortableRelativePathElement extends DTStructure {
  referenceTypeId: DTPortableNodeId; // ExtensionObject ns=0;i=24106
  isInverse: boolean; // Boolean ns=0;i=1
  includeSubtypes: boolean; // Boolean ns=0;i=1
  targetName: DTPortableQualifiedName; // ExtensionObject ns=0;i=24105
}
export interface UDTPortableRelativePathElement extends ExtensionObject, DTPortableRelativePathElement {};