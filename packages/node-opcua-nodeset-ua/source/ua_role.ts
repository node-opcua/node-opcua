// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTIdentityMappingRule } from "./dt_identity_mapping_rule"
import { DTEndpoint } from "./dt_endpoint"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |RoleType ns=0;i=15620                             |
 * |isAbstract      |false                                             |
 */
export interface UARole_Base {
    identities: UAProperty<DTIdentityMappingRule[], /*z*/DataType.ExtensionObject>;
    applicationsExclude?: UAProperty<boolean, /*z*/DataType.Boolean>;
    applications?: UAProperty<UAString[], /*z*/DataType.String>;
    endpointsExclude?: UAProperty<boolean, /*z*/DataType.Boolean>;
    endpoints?: UAProperty<DTEndpoint[], /*z*/DataType.ExtensionObject>;
    customConfiguration?: UAProperty<boolean, /*z*/DataType.Boolean>;
    addIdentity?: UAMethod;
    removeIdentity?: UAMethod;
    addApplication?: UAMethod;
    removeApplication?: UAMethod;
    addEndpoint?: UAMethod;
    removeEndpoint?: UAMethod;
}
export interface UARole extends UAObject, UARole_Base {
}