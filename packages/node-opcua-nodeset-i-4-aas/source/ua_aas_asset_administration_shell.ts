import type { UAObject } from "node-opcua-address-space-base";

import type { UAAASAsset } from "./ua_aas_asset.js";
import type { UAAASReference } from "./ua_aas_reference.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASAssetAdministrationShellType i=1002                      |
 * |isAbstract      |false                                                       |
 */
export interface UAAASAssetAdministrationShell_Base {
   // PlaceHolder for $ConceptDictionary$
   // PlaceHolder for $DataSpecification$
   // PlaceHolder for $Submodel$
   // PlaceHolder for $SubmodelReference$
   // PlaceHolder for $View$
    asset: UAAASAsset;
    derivedFrom?: UAAASReference;
}
export interface UAAASAssetAdministrationShell extends UAObject, UAAASAssetAdministrationShell_Base {}