import type { UAString } from "node-opcua-basic-types";
import type { EnumMessageSecurityMode } from "node-opcua-nodeset-ua/dist/enum_message_security_mode.js";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTServerAddress } from "./dt_server_address.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ServerAddressType i=2003                                    |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTServerAddress i=1036                                      |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAServerAddress_Base<T extends DTServerAddress>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    address: UASelectionList<UAString, DataType.String>;
    securityMode: UASelectionList<EnumMessageSecurityMode, DataType.Int32>;
    securityPolicyUri: UASelectionList<UAString, DataType.String>;
    serverUri: UASelectionList<UAString, DataType.String>;
}
export interface UAServerAddress<T extends DTServerAddress> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAServerAddress_Base<T> {}