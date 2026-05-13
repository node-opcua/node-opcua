import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTReferenceDescription } from "./dt_reference_description";
import type { DTReferenceListEntry } from "./dt_reference_list_entry";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ReferenceDescriptionVariableType i=32657                    |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTReferenceDescription i=32659                              |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAReferenceDescriptionVariable_Base<T extends DTReferenceDescription>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    referenceRefinement?: UAProperty<DTReferenceListEntry[], DataType.ExtensionObject>;
}
export interface UAReferenceDescriptionVariable<T extends DTReferenceDescription> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAReferenceDescriptionVariable_Base<T> {}