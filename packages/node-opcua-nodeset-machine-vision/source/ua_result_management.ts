import type { UAMethod, UAObject } from "node-opcua-address-space-base";

import type { UAResultFolder } from "./ua_result_folder";
import type { UAResultTransfer } from "./ua_result_transfer";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultManagementType i=1007                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAResultManagement_Base {
    getResultById: UAMethod;
    getResultComponentsById: UAMethod;
    getResultListFiltered: UAMethod;
    releaseResultHandle?: UAMethod;
    results?: UAResultFolder;
    resultTransfer?: UAResultTransfer;
}
export interface UAResultManagement extends UAObject, UAResultManagement_Base {}