// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAStateVariable } from "node-opcua-nodeset-ua/source/ua_state_variable"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UALockingServices } from "node-opcua-nodeset-di/source/ua_locking_services"
import { UAProductionStateMachine } from "./ua_production_state_machine"
import { UAInitializingSubStateMachine } from "./ua_initializing_sub_state_machine"
import { UAInstruction } from "./ua_instruction"
export interface UAProductionJob_state extends Omit<UAProductionStateMachine, "currentState"> { // Object
      currentState: UAStateVariable<LocalizedText>;
      initializedState: UAInitializingSubStateMachine;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:ProductionJobType ns=13;i=1004                 |
 * |isAbstract      |false                                             |
 */
export interface UAProductionJob_Base {
    abortJob?: UAMethod;
    endTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    identifier: UAProperty<UAString, /*z*/DataType.String>;
    inputMaterials: UAFolder;
    instruction: UAInstruction;
    jobGroup?: UAProperty<UAString, /*z*/DataType.String>;
    lock?: UALockingServices;
    name?: UAProperty<UAString, /*z*/DataType.String>;
    numberInList: UAProperty<UInt16, /*z*/DataType.UInt16>;
    outputMaterials: UAFolder;
    queueJob?: UAMethod;
    releaseJob?: UAMethod;
    startTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    state: UAProductionJob_state;
    suspendJob?: UAMethod;
}
export interface UAProductionJob extends UAObject, UAProductionJob_Base {
}