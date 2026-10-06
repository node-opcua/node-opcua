import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTPortableRelativePathElement } from "./dt_portable_relative_path_element.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PortableRelativePath                                        |
 * | isAbstract|false                                                       |
 */
export interface DTPortableRelativePath extends DTStructure {
  elements: DTPortableRelativePathElement[]; // ExtensionObject ns=35;i=1051
}
export interface UDTPortableRelativePath extends ExtensionObject, DTPortableRelativePath {};