import type { UAMethod } from "node-opcua-address-space-base";
import type { Byte } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InstallationStateMachineType i=249                          |
 * |isAbstract      |false                                                       |
 */
export interface UAInstallationStateMachine_Base extends UAFiniteStateMachine_Base {
    percentComplete?: UABaseDataVariable<Byte, DataType.Byte>;
    installationDelay?: UABaseDataVariable<number, DataType.Double>;
    installSoftwarePackage?: UAMethod;
    installFiles?: UAMethod;
    uninstall?: UAMethod;
    resume: UAMethod;
    idle: UAInitialState;
    installing: UAState;
    error: UAState;
    idleToInstalling: UATransition;
    installingToIdle: UATransition;
    installingToError: UATransition;
    errorToIdle: UATransition;
}
export interface UAInstallationStateMachine extends UAFiniteStateMachine, UAInstallationStateMachine_Base {}