import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UACondition, UACondition_Base } from "./ua_condition";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DialogConditionType i=2830                                  |
 * |isAbstract      |false                                                       |
 */
export interface UADialogCondition_Base extends UACondition_Base {
    enabledState: UATwoStateVariable<LocalizedText>;
    dialogState: UATwoStateVariable<LocalizedText>;
    prompt: UAProperty<LocalizedText, DataType.LocalizedText>;
    responseOptionSet: UAProperty<LocalizedText[], DataType.LocalizedText>;
    defaultResponse: UAProperty<Int32, DataType.Int32>;
    okResponse: UAProperty<Int32, DataType.Int32>;
    cancelResponse: UAProperty<Int32, DataType.Int32>;
    lastResponse: UAProperty<Int32, DataType.Int32>;
    respond: UAMethod;
    respond2?: UAMethod;
}
export interface UADialogCondition extends Omit<UACondition, "enabledState">, UADialogCondition_Base {}