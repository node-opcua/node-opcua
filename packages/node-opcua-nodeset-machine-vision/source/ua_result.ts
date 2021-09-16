// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTResult } from "./dt_result"
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
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |4:ResultType ns=4;i=2002                          |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTResult ns=4;i=3006                              |
 * |isAbstract      |false                                             |
 */
export interface UAResult_Base<T extends DTResult/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    creationTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    externalConfigurationId?: UABaseDataVariable<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    externalRecipeId?: UABaseDataVariable<DTRecipeIdExternal, /*z*/DataType.ExtensionObject>;
    hasTransferableDataOnFile?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    internalConfigurationId: UABaseDataVariable<DTConfigurationId, /*z*/DataType.ExtensionObject>;
    internalRecipeId: UABaseDataVariable<DTRecipeIdInternal, /*z*/DataType.ExtensionObject>;
    isPartial: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isSimulated?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    jobId: UABaseDataVariable<DTJobId, /*z*/DataType.ExtensionObject>;
    measId?: UABaseDataVariable<DTMeasId, /*z*/DataType.ExtensionObject>;
    partId?: UABaseDataVariable<DTPartId, /*z*/DataType.ExtensionObject>;
    processingTimes?: UABaseDataVariable<DTProcessingTimes, /*z*/DataType.ExtensionObject>;
    productId?: UABaseDataVariable<DTProductId, /*z*/DataType.ExtensionObject>;
    resultContent?: UABaseDataVariable<any, any>;
    resultId: UABaseDataVariable<DTResultId, /*z*/DataType.ExtensionObject>;
    resultState: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
}
export interface UAResult<T extends DTResult/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAResult_Base<T /*B*/> {
}