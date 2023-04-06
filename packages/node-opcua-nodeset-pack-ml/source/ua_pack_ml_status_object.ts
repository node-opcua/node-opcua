// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
import { DTPackMLProduct } from "./dt_pack_ml_product"
import { DTPackMLRemoteInterface } from "./dt_pack_ml_remote_interface"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |15:PackMLStatusObjectType ns=15;i=4               |
 * |isAbstract      |false                                             |
 */
export interface UAPackMLStatusObject_Base {
    curMachSpeed: UAAnalogItem<number, DataType.Float>;
    equipmentBlocked: UABaseDataVariable<boolean, DataType.Boolean>;
    equipmentStarved: UABaseDataVariable<boolean, DataType.Boolean>;
    machSpeed: UAAnalogItem<number, DataType.Float>;
    materialInterlock?: UABaseDataVariable<boolean[], DataType.Boolean>;
    materialInterlocked?: UABaseDataVariable<boolean, DataType.Boolean>;
    parameter?: UABaseDataVariable<DTPackMLDescriptor[], DataType.ExtensionObject>;
    product?: UABaseDataVariable<DTPackMLProduct[], DataType.ExtensionObject>;
    remoteParameter?: UABaseDataVariable<DTPackMLRemoteInterface[], DataType.ExtensionObject>;
    stateChangeInProcess?: UABaseDataVariable<boolean, DataType.Boolean>;
    stateRequested?: UABaseDataVariable<Int32, DataType.Int32>;
    unitModeChangeInProcess?: UABaseDataVariable<boolean, DataType.Boolean>;
    unitModeCurrent: UABaseDataVariable<Int32, DataType.Int32>;
    unitModeRequested?: UABaseDataVariable<boolean, DataType.Boolean>;
    unitSupportedModes: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAPackMLStatusObject extends UAObject, UAPackMLStatusObject_Base {
}