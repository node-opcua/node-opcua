// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTModelChangeStructure } from "./dt_model_change_structure"
import { UABaseModelChangeEvent, UABaseModelChangeEvent_Base } from "./ua_base_model_change_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |GeneralModelChangeEventType ns=0;i=2133           |
 * |isAbstract      |true                                              |
 */
export interface UAGeneralModelChangeEvent_Base extends UABaseModelChangeEvent_Base {
    changes: UAProperty<DTModelChangeStructure[], /*z*/DataType.ExtensionObject>;
}
export interface UAGeneralModelChangeEvent extends UABaseModelChangeEvent, UAGeneralModelChangeEvent_Base {
}