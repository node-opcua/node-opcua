// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32 } from "node-opcua-basic-types"
import { UACondition, UACondition_Base } from "./ua_condition"
import { UATwoStateVariable } from "./ua_two_state_variable"
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
export interface UADialogCondition extends Omit<UACondition, "enabledState">, UADialogCondition_Base {
}