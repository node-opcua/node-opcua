import type { UAAASReference } from "./ua_aas_reference.js";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASReferenceElementType i=1020                              |
 * |isAbstract      |false                                                       |
 */
export interface UAAASReferenceElement_Base extends UAAASSubmodelElement_Base {
    value: UAAASReference;
}
export interface UAAASReferenceElement extends UAAASSubmodelElement, UAAASReferenceElement_Base {}