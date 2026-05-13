import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt64 } from "node-opcua-basic-types";
import type { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua/dist/ua_acknowledgeable_condition";
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
 * |typedDefinition |VisionConditionType i=1033                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAVisionCondition_Base extends UAAcknowledgeableCondition_Base {
    blockReaction: UAProperty<boolean, DataType.Boolean>;
    causePath?: UAProperty<UAString, DataType.String>;
    errorCode?: UAProperty<UInt64, DataType.UInt64>;
    errorString?: UAProperty<UAString, DataType.String>;
    externalConfigurationId?: UAProperty<DTConfigurationId, DataType.ExtensionObject>;
    externalRecipeId?: UAProperty<DTRecipeIdExternal, DataType.ExtensionObject>;
    internalConfigurationId?: UAProperty<DTConfigurationId, DataType.ExtensionObject>;
    internalRecipeId?: UAProperty<DTRecipeIdInternal, DataType.ExtensionObject>;
    jobId?: UAProperty<DTJobId, DataType.ExtensionObject>;
    measId?: UAProperty<DTMeasId, DataType.ExtensionObject>;
    partId?: UAProperty<DTPartId, DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, DataType.ExtensionObject>;
    resultId?: UAProperty<DTResultId, DataType.ExtensionObject>;
    stopReaction: UAProperty<boolean, DataType.Boolean>;
}
export interface UAVisionCondition extends UAAcknowledgeableCondition, UAVisionCondition_Base {}