import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file.js";
import type { DataType } from "node-opcua-variant";

import type { DTFxVersion } from "./dt_fx_version.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AcDescriptorType i=1027                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAcDescriptor_Base {
    descriptorFile?: UAFile;
    descriptorIdentifier?: UAProperty<UAString, DataType.String>;
    descriptorVersion?: UAProperty<DTFxVersion, DataType.ExtensionObject>;
}
export interface UAAcDescriptor extends UAObject, UAAcDescriptor_Base {}