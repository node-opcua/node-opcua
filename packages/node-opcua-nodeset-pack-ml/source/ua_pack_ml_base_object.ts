import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAPackMLAdminObject } from "./ua_pack_ml_admin_object";
import type { UAPackMLBaseStateMachine } from "./ua_pack_ml_base_state_machine";
import type { UAPackMLStatusObject } from "./ua_pack_ml_status_object";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackMLBaseObjectType i=6                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAPackMLBaseObject_Base {
    admin: UAPackMLAdminObject;
    baseStateMachine: UAPackMLBaseStateMachine;
    packMLVersion?: UAProperty<UAString, DataType.String>;
    remoteCommand?: UAMethod;
    setInterlock?: UAMethod;
    setMachSpeed: UAMethod;
    setParameter: UAMethod;
    setProduct: UAMethod;
    setUnitMode: UAMethod;
    status: UAPackMLStatusObject;
    tagID?: UAProperty<UAString, DataType.String>;
}
export interface UAPackMLBaseObject extends UAObject, UAPackMLBaseObject_Base {}