import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTIntervalRange } from "node-opcua-nodeset-fx-data/dist/dt_interval_range.js";
import type { DTNetworkAddress } from "node-opcua-nodeset-ua/dist/dt_network_address.js";
import type { EnumMessageSecurityMode } from "node-opcua-nodeset-ua/dist/enum_message_security_mode.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTCommunicationFlowQos } from "./dt_communication_flow_qos.js";
import type { UACommunicationFlowConfiguration, UACommunicationFlowConfiguration_Base } from "./ua_communication_flow_configuration.js";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubCommunicationFlowConfiguration_publishingInterval<T, DT extends DataType> extends Omit<UASelectionList<T, DT>, "selections"> { // Variable
      availableRanges?: UAProperty<DTIntervalRange[], DataType.ExtensionObject>;
      selections: UAProperty<any, any>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubCommunicationFlowConfigurationType i=1014             |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubCommunicationFlowConfiguration_Base extends UACommunicationFlowConfiguration_Base {
   // PlaceHolder for $SubscriberConfiguration$
    address?: UASelectionList<DTNetworkAddress, DataType.ExtensionObject>;
    headerLayoutUri?: UASelectionList<UAString, DataType.String>;
    publishingInterval?: UAPubSubCommunicationFlowConfiguration_publishingInterval<number, DataType.Double>;
    qos?: UASelectionList<DTCommunicationFlowQos, DataType.ExtensionObject>;
    securityGroupId?: UASelectionList<UAString, DataType.String>;
    securityMode?: UASelectionList<EnumMessageSecurityMode, DataType.Int32>;
    transportProfileUri?: UASelectionList<UAString, DataType.String>;
}
export interface UAPubSubCommunicationFlowConfiguration extends UACommunicationFlowConfiguration, UAPubSubCommunicationFlowConfiguration_Base {}