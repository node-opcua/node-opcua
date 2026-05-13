import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

import type { DTConfigurationId } from "./dt_configuration_id";
import type { DTJobId } from "./dt_job_id";
import type { DTMeasId } from "./dt_meas_id";
import type { DTPartId } from "./dt_part_id";
import type { DTProductId } from "./dt_product_id";
import type { DTRecipeIdExternal } from "./dt_recipe_id_external";
import type { DTRecipeIdInternal } from "./dt_recipe_id_internal";
import type { DTResultId } from "./dt_result_id";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VisionEventType i=1015                                      |
 * |isAbstract      |true                                                        |
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
export interface UAVisionEvent extends UABaseEvent, UAVisionEvent_Base {}