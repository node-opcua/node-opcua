// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
import { DTPackMLProduct } from "./dt_pack_ml_product"
import { DTPackMLRemoteInterface } from "./dt_pack_ml_remote_interface"
import { UAPackMLAdminObject } from "./ua_pack_ml_admin_object"
import { UAPackMLBaseStateMachine } from "./ua_pack_ml_base_state_machine"
import { UAPackMLStatusObject } from "./ua_pack_ml_status_object"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |15:PackMLBaseObjectType ns=15;i=6                 |
 * |isAbstract      |false                                             |
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