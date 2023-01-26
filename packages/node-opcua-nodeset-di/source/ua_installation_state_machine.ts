// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Byte } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:InstallationStateMachineType ns=1;i=249         |
 * |isAbstract      |false                                             |
 */
export interface UAInstallationStateMachine_Base extends UAFiniteStateMachine_Base {
    percentComplete?: UABaseDataVariable<Byte, DataType.Byte>;
    installationDelay?: UABaseDataVariable<number, DataType.Double>;
    installSoftwarePackage?: UAMethod;
    installFiles?: UAMethod;
    resume: UAMethod;
    idle: UAInitialState;
    installing: UAState;
    error: UAState;
    idleToInstalling: UATransition;
    installingToIdle: UATransition;
    installingToError: UATransition;
    errorToIdle: UATransition;
}
export interface UAInstallationStateMachine extends UAFiniteStateMachine, UAInstallationStateMachine_Base {
}