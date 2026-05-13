import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTSemanticChangeStructure } from "./dt_semantic_change_structure";
import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SemanticChangeEventType i=2738                              |
 * |isAbstract      |true                                                        |
 */
export interface UASemanticChangeEvent_Base extends UABaseEvent_Base {
    changes: UAProperty<DTSemanticChangeStructure[], DataType.ExtensionObject>;
}
export interface UASemanticChangeEvent extends UABaseEvent, UASemanticChangeEvent_Base {}