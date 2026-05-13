import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BlockType i=1003                                            |
 * |isAbstract      |true                                                        |
 */
export interface UABlock_Base extends UATopologyElement_Base {
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    actualMode?: UAProperty<LocalizedText, DataType.LocalizedText>;
    permittedMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    normalMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    targetMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
export interface UABlock extends UATopologyElement, UABlock_Base {}