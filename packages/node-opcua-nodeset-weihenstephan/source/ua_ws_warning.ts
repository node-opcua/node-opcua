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
 * |typedDefinition |WSWarningType i=1003                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAWSWarning_Base extends UAWSBaseObject_Base {
    wsWarningCode: UABaseDataVariable<UInt32, DataType.UInt32>;
    wsWarningMessage?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAWSWarning extends UAWSBaseObject, UAWSWarning_Base {}