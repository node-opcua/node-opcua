import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UAAASReference } from "./ua_aas_reference";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASMultiLanguagePropertyType i=1012                         |
 * |isAbstract      |false                                                       |
 */
export interface UAAASMultiLanguageProperty_Base extends UAAASSubmodelElement_Base {
    value?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    valueId?: UAAASReference;
}
export interface UAAASMultiLanguageProperty extends UAAASSubmodelElement, UAAASMultiLanguageProperty_Base {}