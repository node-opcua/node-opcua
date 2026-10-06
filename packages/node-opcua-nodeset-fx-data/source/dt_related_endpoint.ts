import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTPortableQualifiedName } from "node-opcua-nodeset-ua/dist/dt_portable_qualified_name.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |RelatedEndpointDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTRelatedEndpoint extends DTStructure {
  address: UAString; // String ns=0;i=23751
  connectionEndpointPath: DTPortableQualifiedName[]; // ExtensionObject ns=0;i=24105
  connectionEndpointName: UAString; // String ns=0;i=12
}
export interface UDTRelatedEndpoint extends ExtensionObject, DTRelatedEndpoint {};