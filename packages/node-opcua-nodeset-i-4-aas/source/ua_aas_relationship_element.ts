import type { UAAASReference } from "./ua_aas_reference";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASRelationshipElementType i=1018                           |
 * |isAbstract      |false                                                       |
 */
export interface UAAASRelationshipElement_Base extends UAAASSubmodelElement_Base {
    first: UAAASReference;
    second: UAAASReference;
}
export interface UAAASRelationshipElement extends UAAASSubmodelElement, UAAASRelationshipElement_Base {}