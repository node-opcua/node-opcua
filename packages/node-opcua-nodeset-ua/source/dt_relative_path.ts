import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTRelativePathElement } from "./dt_relative_path_element";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |RelativePath                                                |
 * | isAbstract|false                                                       |
 */
export interface DTRelativePath extends DTStructure {
  elements: DTRelativePathElement[]; // ExtensionObject ns=0;i=537
}
export interface UDTRelativePath extends ExtensionObject, DTRelativePath {};