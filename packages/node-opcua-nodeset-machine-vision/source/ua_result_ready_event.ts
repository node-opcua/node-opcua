// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTConfigurationId } from "./dt_configuration_id"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTJobId } from "./dt_job_id"
import { DTMeasId } from "./dt_meas_id"
import { DTPartId } from "./dt_part_id"
import { DTProcessingTimes } from "./dt_processing_times"
import { DTProductId } from "./dt_product_id"
import { DTResultId } from "./dt_result_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ResultReadyEventType ns=4;i=1024                |
 * |isAbstract      |false                                             |
 */
export interface UAResultReadyEvent_Base extends UABaseEvent_Base {
    creationTime: UAProperty<Date, /*z*/DataType.DateTime>;
    externalConfigurationId?: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    externalRecipeId?: UAProperty<DTRecipeIdExternal, /*z*/DataType.ExtensionObject>;
    internalConfigurationId: UAProperty<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    internalRecipeId: UAProperty<DTRecipeIdInternal, /*z*/DataType.ExtensionObject>;
    isPartial: UAProperty<boolean, /*z*/DataType.Boolean>;
    isSimulated?: UAProperty<boolean, /*z*/DataType.Boolean>;
    jobId: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
    measId?: UAProperty<DTMeasId, /*z*/DataType.ExtensionObject>;
    partId?: UAProperty<DTPartId, /*z*/DataType.ExtensionObject>;
    processingTimes?: UAProperty<DTProcessingTimes, /*z*/DataType.ExtensionObject>;
    productId?: UAProperty<DTProductId, /*z*/DataType.ExtensionObject>;
    resultContent?: UAProperty<any, any>;
    resultId: UAProperty<DTResultId, /*z*/DataType.ExtensionObject>;
    resultState: UAProperty<Int32, /*z*/DataType.Int32>;
}
export interface UAResultReadyEvent extends UABaseEvent, UAResultReadyEvent_Base {
}