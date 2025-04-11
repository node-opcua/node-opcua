// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAPackMLAdminObject } from "./ua_pack_ml_admin_object"
import { UAPackMLBaseStateMachine } from "./ua_pack_ml_base_state_machine"
import { UAPackMLStatusObject } from "./ua_pack_ml_status_object"
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
export interface UAPackMLBaseObject extends UAObject, UAPackMLBaseObject_Base {
}