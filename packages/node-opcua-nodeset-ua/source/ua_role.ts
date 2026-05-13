import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTEndpoint } from "./dt_endpoint";
import type { DTIdentityMappingRule } from "./dt_identity_mapping_rule";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RoleType i=15620                                            |
 * |isAbstract      |false                                                       |
 */
export interface UARole_Base {
    identities: UAProperty<DTIdentityMappingRule[], DataType.ExtensionObject>;
    applicationsExclude?: UAProperty<boolean, DataType.Boolean>;
    applications?: UAProperty<UAString[], DataType.String>;
    endpointsExclude?: UAProperty<boolean, DataType.Boolean>;
    endpoints?: UAProperty<DTEndpoint[], DataType.ExtensionObject>;
    customConfiguration?: UAProperty<boolean, DataType.Boolean>;
    addIdentity?: UAMethod;
    removeIdentity?: UAMethod;
    addApplication?: UAMethod;
    removeApplication?: UAMethod;
    addEndpoint?: UAMethod;
    removeEndpoint?: UAMethod;
}
export interface UARole extends UAObject, UARole_Base {}