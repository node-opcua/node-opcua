// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt64, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua/source/ua_acknowledgeable_condition"
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
 * |typedDefinition |4:VisionConditionType ns=4;i=1033                 |
 * |isAbstract      |true                                              |
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
export interface UAVisionCondition extends UAAcknowledgeableCondition, UAVisionCondition_Base {
}