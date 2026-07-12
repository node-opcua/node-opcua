import type { UAAASAdministrativeInformation } from "./ua_aas_administrative_information";
import type { UAAASIdentifier } from "./ua_aas_identifier";
import type { UAIAASReferable, UAIAASReferable_Base } from "./ua_iaas_referable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAASIdentifiableType i=1034                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAIAASIdentifiable_Base extends UAIAASReferable_Base {
    administration: UAAASAdministrativeInformation;
    identification: UAAASIdentifier;
}
export interface UAIAASIdentifiable extends UAIAASReferable, UAIAASIdentifiable_Base {}