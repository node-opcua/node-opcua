import type { UAObject } from "node-opcua-address-space-base";
import type { DTNetworkAddress } from "node-opcua-nodeset-ua/dist/dt_network_address.js";
import type { DTReceiveQos } from "node-opcua-nodeset-ua/dist/dt_receive_qos.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SubscriberConfigurationType i=1001                          |
 * |isAbstract      |false                                                       |
 */
export interface UASubscriberConfiguration_Base {
    address?: UASelectionList<DTNetworkAddress, DataType.ExtensionObject>;
    messageReceiveTimeout: UASelectionList<number, DataType.Double>;
    receiveQos?: UASelectionList<DTReceiveQos[], DataType.ExtensionObject>;
}
export interface UASubscriberConfiguration extends UAObject, UASubscriberConfiguration_Base {}