import type { LocalizedText } from "node-opcua-data-model";

import type { UAGuardVariable, UAGuardVariable_Base } from "./ua_guard_variable";

// ----- this file has been automatically generated - do not edit
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ElseGuardVariableType i=15317                               |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export type UAElseGuardVariable_Base<T extends LocalizedText> = UAGuardVariable_Base<T>;
export interface UAElseGuardVariable<T extends LocalizedText> extends UAGuardVariable<T>, UAElseGuardVariable_Base<T> {}