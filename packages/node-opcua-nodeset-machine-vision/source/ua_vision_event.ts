// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTConfigurationId } from "./dt_configuration_id"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTJobId } from "./dt_job_id"
import { DTMeasId } from "./dt_meas_id"
import { DTPartId } from "./dt_part_id"
import { DTProductId } from "./dt_product_id"
import { DTResultId } from "./dt_result_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:VisionEventType ns=4;i=1015                     |
 * |isAbstract      |true                                              |
 */
export interface UAVisionEvent_Base extends UABaseEvent_Base {
    causePath?: UAProperty<UAString, DataType.String>;
    externalConfigurationId?: UAProperty<DTConfigurationId, DataType.ExtensionObject>;
    externalRecipeId?: UAProperty<DTRecipeIdExternal, DataType.ExtensionObject>;
    internalConfigurationId?: UAProperty<DTConfigurationId, DataType.ExtensionObject>;
    internalRecipeId?: UAProperty<DTRecipeIdInternal, DataType.ExtensionObject>;
    jobId?: UAProperty<DTJobId, DataType.ExtensionObject>;
    measId?: UAProperty<DTMeasId, DataType.ExtensionObject>;
    partId?: UAProperty<DTPartId, DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, DataType.ExtensionObject>;
    resultId?: UAProperty<DTResultId, DataType.ExtensionObject>;
}
export interface UAVisionEvent extends UABaseEvent, UAVisionEvent_Base {
}