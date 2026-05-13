import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UALockingServices } from "node-opcua-nodeset-di/dist/ua_locking_services";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UATwoStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_two_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAStatistic } from "./ua_statistic";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a product related to the scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductType i=11                                            |
 * |isAbstract      |true                                                        |
 */
export interface UAProduct_Base {
    /**
     * batchId
     * Defines a unique Id of this Batch.
     */
    batchId?: UAProperty<UAString, DataType.String>;
    /**
     * batchName
     * Defines the name of this Batch.
     */
    batchName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * jobId
     * Defines a unique Id of this job.
     */
    jobId?: UAProperty<UAString, DataType.String>;
    /**
     * jobName
     * Defines the name of this job.
     */
    jobName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    lock?: UALockingServices;
    presetTare?: UAAnalogUnit<any, any>;
    /**
     * productId
     * Defines a unique Id of this product.
     */
    productId: UABaseDataVariable<UAString, DataType.String>;
    productMode?: UATwoStateDiscrete<boolean>;
    /**
     * productName
     * Defines the name of this product.
     */
    productName: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * statistic
     * Contains the different statistic values of the
     * product.
     */
    statistic?: UAStatistic;
}
export interface UAProduct extends UAObject, UAProduct_Base {}