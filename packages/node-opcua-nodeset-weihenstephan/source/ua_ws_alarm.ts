import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAWSBaseObject, UAWSBaseObject_Base } from "./ua_ws_base_object.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSAlarmType i=1002                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAWSAlarm_Base extends UAWSBaseObject_Base {
    wsAlarmCode: UABaseDataVariable<UInt32, DataType.UInt32>;
    wsAlarmMessage?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAWSAlarm extends UAWSBaseObject, UAWSAlarm_Base {}