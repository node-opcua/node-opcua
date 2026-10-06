import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { DTRelatedEndpoint } from "node-opcua-nodeset-fx-data/dist/dt_related_endpoint.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { EnumConnectionEndpointStatusEnum } from "./enum_connection_endpoint_status_enum.js";

// ----- this file has been automatically generated - do not edit

export interface UAConnectionEndpoint_diagnostics extends UAFunctionalGroup { // Object
      creationTime?: UABaseDataVariable<Date, DataType.DateTime>;
      modificationTime?: UABaseDataVariable<Date, DataType.DateTime>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionEndpointType i=1002                               |
 * |isAbstract      |true                                                        |
 */
export interface UAConnectionEndpoint_Base {
    cleanupTimeout: UABaseDataVariable<number, DataType.Double>;
    connectionManagerApplicationUri?: UABaseDataVariable<UAString, DataType.String>;
    diagnostics?: UAConnectionEndpoint_diagnostics;
    inputVariables?: UABaseDataVariable<NodeId[], DataType.NodeId>;
    isPersistent: UABaseDataVariable<boolean, DataType.Boolean>;
    outputVariables?: UABaseDataVariable<NodeId[], DataType.NodeId>;
    relatedEndpoint: UABaseDataVariable<DTRelatedEndpoint, DataType.ExtensionObject>;
    status: UABaseDataVariable<EnumConnectionEndpointStatusEnum, DataType.Int32>;
}
export interface UAConnectionEndpoint extends UAObject, UAConnectionEndpoint_Base {}