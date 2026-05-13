import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTContentFilterElement } from "./dt_content_filter_element";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ContentFilter                                               |
 * | isAbstract|false                                                       |
 */
export interface DTContentFilter extends DTStructure {
  elements: DTContentFilterElement[]; // ExtensionObject ns=0;i=583
}
export interface UDTContentFilter extends ExtensionObject, DTContentFilter {};