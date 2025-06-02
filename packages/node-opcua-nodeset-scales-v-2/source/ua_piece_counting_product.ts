// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { DTWeight } from "./dt_weight"
import { UAProduct, UAProduct_Base } from "./ua_product"
import { UATargetItem } from "./ua_target_item"
import { UAWeightItem } from "./ua_weight_item"
/**
 * Represents a product of a piece counting scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PieceCountingProductType i=12                               |
 * |isAbstract      |false                                                       |
 */
export interface UAPieceCountingProduct_Base extends UAProduct_Base {
    /**
     * currentItemCount
     * Defines the current number of items that are
     * captured by the scale.
     */
    currentItemCount?: UABaseDataVariable<any, any>;
    /**
     * feedRateMeasuringInterval
     * Defines the measurement interval for evaluating
     * the current flowrate.
     */
    feedRateMeasuringInterval?: UABaseDataVariable<number, DataType.Double>;
    /**
     * fillingTime
     * Defines the interval during which the filling has
     * to be completed.
     */
    fillingTime?: UABaseDataVariable<number, DataType.Double>;
    fineFeedCount?: UABaseDataVariable<any, any>;
    /**
     * inFlightCount
     * Defines the number of items that is behind valve
     * / in flight after feeding is stopped.
     */
    inFlightCount?: UABaseDataVariable<any, any>;
    /**
     * jogFeed
     * Defines if an additional dosage is necessary.
     */
    jogFeed?: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * minimumDeltaPerFeedRateMeasuringInterval
     * Defines the minimum amount of weight that needs
     * to change within the FeedRateMeasuringInterval.
     * Otherwise the filling procedure is not valid.
     */
    minimumDeltaPerFeedRateMeasuringInterval?: UAAnalogItem<any, any>;
    /**
     * numberOfReferencePieces
     * Defines the number of pieces that need to be used
     * for reference process.
     */
    numberOfReferencePieces: UABaseDataVariable<any, any>;
    /**
     * referencePieceWeight
     * Defines the reference weight of a piece.
     */
    referencePieceWeight: UAAnalogItem<any, any>;
    /**
     * registeredPieceCount
     * Defines the number of pieces that were actually
     * counted related to the ReferencePieceWeight.
     */
    registeredPieceCount: UABaseDataVariable<any, any>;
    setTargetItemCount?: UAMethod;
    setTargetPieceCount?: UAMethod;
    /**
     * settlingTime
     * Defines the time that needs to be passed before
     * measurement process can be triggered.
     */
    settlingTime?: UABaseDataVariable<number, DataType.Double>;
    /**
     * tareId
     * Defines the Id of tare value for the current
     * product or item.
     */
    tareId?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * targetItemCount
     * Defines the number of items that are supposed to
     * be counted during the measurement process.
     */
    targetItemCount?: UABaseDataVariable<any, any>;
    /**
     * targetPieceCount
     * Defines the number of pieces that need to be
     * counted.
     */
    targetPieceCount?: UATargetItem<any, any>;
    /**
     * totalizedItemCount
     * Defines the summed up number of items. Will be
     * reset either triggered by the user or a different
     * product selection.
     */
    totalizedItemCount?: UABaseDataVariable<any, any>;
    /**
     * totalizedWeight
     * Defines the summed up number of weight. Will be
     * reset either triggered by the user or a different
     * product selection.
     */
    totalizedWeight?: UAWeightItem<DTWeight>;
}
export interface UAPieceCountingProduct extends UAProduct, UAPieceCountingProduct_Base {
}