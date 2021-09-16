// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
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
    blockReaction: UAProperty<boolean, /*z*/DataType.Boolean>;
    causePath?: UAProperty<UAString, /*z*/DataType.String>;
    errorCode?: UAProperty<UInt64, /*z*/DataType.UInt64>;
    errorString?: UAProperty<UAString, /*z*/DataType.String>;
    externalConfigurationId?: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    externalRecipeId?: UAProperty<DTRecipeIdExternal, /*z*/DataType.ExtensionObject>;
    internalConfigurationId?: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    internalRecipeId?: UAProperty<DTRecipeIdInternal, /*z*/DataType.ExtensionObject>;
    jobId?: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
    measId?: UAProperty<DTMeasId, /*z*/DataType.ExtensionObject>;
    partId?: UAProperty<DTPartId, /*z*/DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, /*z*/DataType.ExtensionObject>;
    resultId?: UAProperty<DTResultId, /*z*/DataType.ExtensionObject>;
    stopReaction: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAVisionCondition extends UAAcknowledgeableCondition, UAVisionCondition_Base {
}