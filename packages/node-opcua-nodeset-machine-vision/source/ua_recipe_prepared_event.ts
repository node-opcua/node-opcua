// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTProductId } from "./dt_product_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:RecipePreparedEventType ns=4;i=1022             |
 * |isAbstract      |false                                             |
 */
export interface UARecipePreparedEvent_Base extends UABaseEvent_Base {
    externalId?: UAProperty<DTRecipeIdExternal, DataType.ExtensionObject>;
    internalId: UAProperty<DTRecipeIdInternal, DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, DataType.ExtensionObject>;
}
export interface UARecipePreparedEvent extends UABaseEvent, UARecipePreparedEvent_Base {
}