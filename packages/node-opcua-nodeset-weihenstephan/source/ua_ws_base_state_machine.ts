import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UAPackMLBaseStateMachine, UAPackMLBaseStateMachine_Base } from "node-opcua-nodeset-pack-ml/dist/ua_pack_ml_base_state_machine";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSBaseStateMachineType i=1004                               |
 * |isAbstract      |false                                                       |
 */
export interface UAWSBaseStateMachine_Base extends UAPackMLBaseStateMachine_Base {
    wsTagNumber?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAWSBaseStateMachine extends UAPackMLBaseStateMachine, UAWSBaseStateMachine_Base {}