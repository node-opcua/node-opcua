import type { UAObject } from "node-opcua-address-space-base";

import type { UAConnectionEndpointConfiguration } from "./ua_connection_endpoint_configuration.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionConfigurationType i=1013                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionConfiguration_Base {
    endpoint1: UAConnectionEndpointConfiguration;
    endpoint2?: UAConnectionEndpointConfiguration;
}
export interface UAConnectionConfiguration extends UAObject, UAConnectionConfiguration_Base {}