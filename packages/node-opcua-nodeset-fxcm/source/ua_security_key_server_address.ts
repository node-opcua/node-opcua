import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTSecurityKeyServerAddress } from "./dt_security_key_server_address.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |SecurityKeyServerAddressType i=2002                         |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTSecurityKeyServerAddress i=3021                           |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UASecurityKeyServerAddress_Base<T extends DTSecurityKeyServerAddress>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    address: UASelectionList<UAString, DataType.String>;
    securityPolicyUri: UASelectionList<UAString, DataType.String>;
    serverUri: UASelectionList<UAString, DataType.String>;
    usePushModel: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UASecurityKeyServerAddress<T extends DTSecurityKeyServerAddress> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASecurityKeyServerAddress_Base<T> {}