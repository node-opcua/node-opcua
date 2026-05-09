import type { QualifiedName } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { UADataType } from "./ua_data_type";
import type { UAVariable } from "./ua_variable";
import type { UAVariableType } from "./ua_variable_type";

// {{ Dynamic Array Variable
export interface UADynamicVariableArray<T extends ExtensionObject = ExtensionObject> extends UAVariable {
    $dataValue: DataValue;
    $$variableType: UAVariableType;
    $$dataType: UADataType;
    $$extensionObjectArray: T[];
    $$getElementBrowseName: (obj: T, index: number) => QualifiedName;
    $$indexPropertyName: string;
}
