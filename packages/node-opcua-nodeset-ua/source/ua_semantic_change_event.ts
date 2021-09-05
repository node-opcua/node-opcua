// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTSemanticChangeStructure } from "./dt_semantic_change_structure"
import { UABaseEvent, UABaseEvent_Base } from "./ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |SemanticChangeEventType ns=0;i=2738               |
 * |isAbstract      |true                                              |
 */
export interface UASemanticChangeEvent_Base extends UABaseEvent_Base {
    changes: UAProperty<DTSemanticChangeStructure[], /*z*/DataType.ExtensionObject>;
}
export interface UASemanticChangeEvent extends UABaseEvent, UASemanticChangeEvent_Base {
}