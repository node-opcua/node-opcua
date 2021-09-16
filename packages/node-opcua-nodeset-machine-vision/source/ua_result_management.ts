// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAResultFolder } from "./ua_result_folder"
import { UAResultTransfer } from "./ua_result_transfer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ResultManagementType ns=4;i=1007                |
 * |isAbstract      |false                                             |
 */
export interface UAResultManagement_Base {
    getResultById: UAMethod;
    getResultComponentsById: UAMethod;
    getResultListFiltered: UAMethod;
    releaseResultHandle?: UAMethod;
    results?: UAResultFolder;
    resultTransfer?: UAResultTransfer;
}
export interface UAResultManagement extends UAObject, UAResultManagement_Base {
}