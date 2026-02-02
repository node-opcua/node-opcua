// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32 } from "node-opcua-basic-types"
import { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element"
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
export interface UABlock extends UATopologyElement, UABlock_Base {
}