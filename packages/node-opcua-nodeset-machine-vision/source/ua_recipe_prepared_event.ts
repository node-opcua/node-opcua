import type { UAProperty } from "node-opcua-address-space-base";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

import type { DTProductId } from "./dt_product_id";
import type { DTRecipeIdExternal } from "./dt_recipe_id_external";
import type { DTRecipeIdInternal } from "./dt_recipe_id_internal";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipePreparedEventType i=1022                              |
 * |isAbstract      |false                                                       |
 */
export interface UARecipePreparedEvent_Base extends UABaseEvent_Base {
    externalId?: UAProperty<DTRecipeIdExternal, DataType.ExtensionObject>;
    internalId: UAProperty<DTRecipeIdInternal, DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, DataType.ExtensionObject>;
}
export interface UARecipePreparedEvent extends UABaseEvent, UARecipePreparedEvent_Base {}