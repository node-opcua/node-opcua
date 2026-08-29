import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";

import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASBlobType i=1016                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAASBlob_Base extends UAAASSubmodelElement_Base {
    file: UAFile;
}
export interface UAAASBlob extends UAAASSubmodelElement, UAAASBlob_Base {}