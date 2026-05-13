import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTModelChangeStructure } from "./dt_model_change_structure";
import type { UABaseModelChangeEvent, UABaseModelChangeEvent_Base } from "./ua_base_model_change_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GeneralModelChangeEventType i=2133                          |
 * |isAbstract      |true                                                        |
 */
export interface UAGeneralModelChangeEvent_Base extends UABaseModelChangeEvent_Base {
    changes: UAProperty<DTModelChangeStructure[], DataType.ExtensionObject>;
}
export interface UAGeneralModelChangeEvent extends UABaseModelChangeEvent, UAGeneralModelChangeEvent_Base {}