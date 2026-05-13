import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SafetyStateManagementType i=1009                            |
 * |isAbstract      |false                                                       |
 */
export interface UASafetyStateManagement_Base {
    reportSafetyState: UAMethod;
    visionSafetyInformation: UABaseDataVariable<UAString, DataType.String>;
    visionSafetyTriggered: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UASafetyStateManagement extends UAObject, UASafetyStateManagement_Base {}