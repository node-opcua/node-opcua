import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";
import type { DataType } from "node-opcua-variant";

import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASFileType i=1017                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAASFile_Base extends UAAASSubmodelElement_Base {
    file?: UAFile;
    mimeType: UAProperty<UAString, DataType.String>;
    value: UAProperty<UAString, DataType.String>;
}
export interface UAAASFile extends UAAASSubmodelElement, UAAASFile_Base {}