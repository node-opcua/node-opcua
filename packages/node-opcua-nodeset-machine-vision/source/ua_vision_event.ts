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
    causePath?: UAProperty<UAString, /*z*/DataType.String>;
    externalConfigurationId?: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    externalRecipeId?: UAProperty<DTRecipeIdExternal, /*z*/DataType.ExtensionObject>;
    internalConfigurationId?: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    internalRecipeId?: UAProperty<DTRecipeIdInternal, /*z*/DataType.ExtensionObject>;
    jobId?: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
    measId?: UAProperty<DTMeasId, /*z*/DataType.ExtensionObject>;
    partId?: UAProperty<DTPartId, /*z*/DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, /*z*/DataType.ExtensionObject>;
    resultId?: UAProperty<DTResultId, /*z*/DataType.ExtensionObject>;
}
export interface UAVisionEvent extends UABaseEvent, UAVisionEvent_Base {
}