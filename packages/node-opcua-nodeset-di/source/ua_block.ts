// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32 } from "node-opcua-basic-types"
import { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element"
/**
 * Adds the concept of Blocks needed for
 * block-oriented FieldDevices
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:BlockType ns=1;i=1003                           |
 * |isAbstract      |true                                              |
 */
export interface UABlock_Base extends UATopologyElement_Base {
    /**
     * revisionCounter
     * Incremental counter indicating the number of
     * times the static data within the Block has been
     * modified
     */
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    /**
     * actualMode
     * Current mode of operation the Block is able to
     * achieve
     */
    actualMode?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * permittedMode
     * Modes of operation that are allowed for the Block
     * based on application requirements
     */
    permittedMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    /**
     * normalMode
     * Mode the Block should be set to during normal
     * operating conditions
     */
    normalMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    /**
     * targetMode
     * Mode of operation that is desired for the Block
     */
    targetMode?: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
export interface UABlock extends UATopologyElement, UABlock_Base {
}