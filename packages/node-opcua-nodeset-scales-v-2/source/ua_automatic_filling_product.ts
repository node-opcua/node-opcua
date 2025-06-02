// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UAProduct, UAProduct_Base } from "./ua_product"
import { UATargetItem } from "./ua_target_item"
/**
 * Represents a product of an automatic filling
 * scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomaticFillingProductType i=16                            |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomaticFillingProduct_Base extends UAProduct_Base {
    /**
     * feedRateMeasuringInterval
     * Defines the measuring interval for evaluating the
     * current flowrate.
     */
    feedRateMeasuringInterval?: UABaseDataVariable<number, DataType.Double>;
    /**
     * fillingTime
     * Defines the maximal duration for the filling
     * process to take place. Needs to be completed
     * during this period.
     */
    fillingTime?: UABaseDataVariable<number, DataType.Double>;
    /**
     * fineFeedWeight
     * Defines the volume to be dosed in fine flow.
     */
    fineFeedWeight?: UAAnalogItem<any, any>;
    /**
     * inFlightWeight
     * Defines the volume that is behind the valve / in
     * flight after feeding is stopped.
     */
    inFlightWeight: UAAnalogItem<any, any>;
    /**
     * jogFeed
     * Defines if an additional dosage is necessary.
     */
    jogFeed?: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * minimumDeltaPerFeedRateMeasuringInterval
     * Defines the minimum amount of weight data which
     * needs to change within the
     * FeedRateMeasuringInterval.
     */
    minimumDeltaPerFeedRateMeasuringInterval?: UAAnalogItem<any, any>;
    /**
     * settlingTime
     * Defines the time that needs to be passed before
     * measurement process can be triggered.
     */
    settlingTime?: UABaseDataVariable<number, DataType.Double>;
    /**
     * tareId
     * Defines an Id of tare value for the current
     * product or item.
     */
    tareId?: UAProperty<UAString, DataType.String>;
    /**
     * targetWeight
     * Defines the preset of the volume to be processed.
     */
    targetWeight: UATargetItem<any, any>;
}
export interface UAAutomaticFillingProduct extends UAProduct, UAAutomaticFillingProduct_Base {
}