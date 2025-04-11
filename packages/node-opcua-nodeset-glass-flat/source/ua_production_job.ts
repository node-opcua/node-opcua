// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAFiniteStateVariable } from "node-opcua-nodeset-ua/dist/ua_finite_state_variable"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UALockingServices } from "node-opcua-nodeset-di/dist/ua_locking_services"
import { UAProductionStateMachine } from "./ua_production_state_machine"
import { UAInitializingSubStateMachine } from "./ua_initializing_sub_state_machine"
import { UAInstruction } from "./ua_instruction"
export interface UAProductionJob_state extends Omit<UAProductionStateMachine, "currentState"> { // Object
      currentState: UAFiniteStateVariable<LocalizedText>;
      initializedState: UAInitializingSubStateMachine;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionJobType i=1004                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionJob_Base {
    abortJob?: UAMethod;
    endTime: UABaseDataVariable<Date, DataType.DateTime>;
    identifier: UAProperty<UAString, DataType.String>;
    inputMaterials: UAFolder;
    instruction: UAInstruction;
    jobGroup?: UAProperty<UAString, DataType.String>;
    lock?: UALockingServices;
    name?: UAProperty<UAString, DataType.String>;
    numberInList: UAProperty<UInt16, DataType.UInt16>;
    outputMaterials: UAFolder;
    queueJob?: UAMethod;
    releaseJob?: UAMethod;
    startTime: UABaseDataVariable<Date, DataType.DateTime>;
    state: UAProductionJob_state;
    suspendJob?: UAMethod;
}
export interface UAProductionJob extends UAObject, UAProductionJob_Base {
}