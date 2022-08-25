// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UABaseAnalog } from "node-opcua-nodeset-ua/source/ua_base_analog"
/**
 * The IWwUnitValuesType represents the values of a
 * unit
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwUnitValuesType ns=12;i=1006                 |
 * |isAbstract      |true                                              |
 */
export interface UAIWwUnitValues_Base extends UABaseInterface_Base {
    /**
     * absoluteErrorTime
     * The AbsoluteErrorTime Variable provides the
     * absolute time in msec of the ERROR_4 state in
     * msec.
     */
    absoluteErrorTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteLength
     * The AbsoluteLength Variable provides the absolute
     * produced length in mm.
     */
    absoluteLength?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteMachineOffTime
     * The AbsoluteOfflineTime can be calculated by the
     * machine. The shutdown time and the starting time
     * have to be stored on the machine.
     */
    absoluteMachineOffTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteMachineOnTime
     * The AbsoluteMachineOnTime Variable provides the
     * absolute time in msec the machine is turned on
     * based on the MachineOn state.
     */
    absoluteMachineOnTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absolutePiecesIn
     * The AbsolutePiecesIn Variable provides the
     * absolute count of pieces which came into the
     * machine.
     */
    absolutePiecesIn?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absolutePiecesOut
     * The AbsolutePiecesOut Variable provides the
     * absolute count of pieces which came out of the
     * machine.
     */
    absolutePiecesOut?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absolutePowerPresentTime
     * The AbsolutePowerPresentTime Variable provides
     * the absolute time in msec the machine has power
     * on based on the PowerPresent state.
     */
    absolutePowerPresentTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteProductionTime
     * The AbsoluteProductionTime Variable provides the
     * absolute time in msec of the machine is working
     * at least with one workpiece based on the
     * RecipeInRun and PiecesPresent state.
     */
    absoluteProductionTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteProductionWaitWorkpieceTime
     * The AbsoluteProductionWaitWorkpieceTime Variable
     * provides the absolute time in msec of the machine
     * is in working mode, bring the consent out to
     * insert workpiece but no workpiece incoming from
     * the previous machine based on the ReceipeInRun
     * and WaitLoad state.
     */
    absoluteProductionWaitWorkpieceTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteProductionWithoutWorkpieceTime
     * The AbsoluteProductionWithoutWorkpieceTime
     * Variable provides the absolute time in msec of
     * the machine is working but without workpieces
     * inside based on the RecipeInRun and
     * !PiecesPresent state.
     */
    absoluteProductionWithoutWorkpieceTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteReadyTime
     * The AbsoluteReadyTime Variable provides the
     * absolute time in msec of the READY_2 state in
     * msec.
     */
    absoluteReadyTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteRunsAborted
     * The AbsoluteRunsAborted Variable provides the
     * absolute count of aborted runs.
     */
    absoluteRunsAborted?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteRunsGood
     * The AbsoluteRunsGood Variable provides the
     * absolute count of finished runs.
     */
    absoluteRunsGood?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteRunsTotal
     * The AbsoluteRunsTotal Variable provides the
     * absolute count of total runs.
     */
    absoluteRunsTotal?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteStandbyTime
     * The AbsoluteStandbyTime Variable provides the
     * absolute time in msec of the STANDBY_1 state in
     * msec.
     */
    absoluteStandbyTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * absoluteWorkingTime
     * The AbsoluteWorkingTime Variable provides the
     * absolute time in msec of the WORKING_3 state in
     * msec.
     */
    absoluteWorkingTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * actualCycle
     * The ActualCycle Variable provides the parts per
     * minutes.
     */
    actualCycle?: UABaseAnalog<number, DataType.Double>;
    /**
     * axisOverride
     * The AxisOverride Variable provides the override
     * for the axis in percent.
     */
    axisOverride?: UABaseAnalog<UInt32, DataType.UInt32>;
    /**
     * feedSpeed
     * The FeedSpeed Variable provides the feed speed in
     * m/min for throughfeed machines.
     */
    feedSpeed?: UABaseAnalog<number, DataType.Double>;
    /**
     * relativeErrorTime
     * The RelativeErrorTime Variable provides the
     * relative time since startup of the ERROR_4 state
     * in msec.
     */
    relativeErrorTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeLength
     * The RelativeLength Variable provides the relative
     * produced length in mm since the machine has
     * started.
     */
    relativeLength?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeMachineOnTime
     * The RelativeMachineOnTime Variable provides the
     * relative time in msec since startup the machine
     * is turned on based on the MachineOn state.
     */
    relativeMachineOnTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativePiecesIn
     * The RelativePiecesIn Variable provides the
     * relative count of pieces which came into the
     * machine since the machine has started.
     */
    relativePiecesIn?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativePiecesOut
     * The RelativePiecesOut Variable provides the
     * relative count of pieces which came out of the
     * machine since the machine has started.
     */
    relativePiecesOut?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativePowerPresentTime
     * The RelativePowerPresentTime Variable provides
     * the relative time in msec since startup the
     * machine has power on based on the PowerPresent
     * state.
     */
    relativePowerPresentTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeProductionTime
     * The RelativeProductionTime Variable provides the
     * relative time in msec since startup of the
     * machine is working at least with one workpiece
     * based on the RecipeInRun and PiecesPresent state.
     */
    relativeProductionTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeProductionWaitWorkpieceTime
     * The RelativeProductionWaitWorkpieceTime Variable
     * provides the relative time in msec waiting for
     * workpieces since startup of the machine is in
     * working mode, bring the consent out to insert
     * workpiece but no workpiece incoming from the
     * previous machine based on the ReceipeInRun and
     * WaitLoad state.
     */
    relativeProductionWaitWorkpieceTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeProductionWithoutWorkpieceTime
     * The RelativeProductionWithoutWorkpieceTime
     * Variable provides the relative time in msec since
     * startup of the machine is working but without
     * workpieces inside based on the RecipeInRun and
     * !PiecesPresent state.
     */
    relativeProductionWithoutWorkpieceTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeReadyTime
     * The RelativeReadyTime Variable provides the
     * relative time since startup of the READY_2 state
     * in msec.
     */
    relativeReadyTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeRunsAborted
     * The RelativeRunsAborted Variable provides the
     * relative count of aborted runs since the machine
     * has started.
     */
    relativeRunsAborted?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeRunsGood
     * The RelativeRunsGood Variable provides the
     * relative count of finished runs since the machine
     * has started.
     */
    relativeRunsGood?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeRunsTotal
     * The RelativeRunsTotal Variable provides the
     * relative count of total runs since the machine
     * has started.
     */
    relativeRunsTotal?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeStandbyTime
     * The RelativeStandbyTime Variable provides the
     * relative time since startup of the STANDBY_1
     * state in msec.
     */
    relativeStandbyTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * relativeWorkingTime
     * The RelativeWorkingTime Variable provides the
     * relative time since startup of the WORKING_3
     * state in msec.
     */
    relativeWorkingTime?: UABaseAnalog<UInt64, DataType.UInt64>;
    /**
     * spindleOverride
     * The SpindleOverride Variable provides the
     * override for the spindle in percent.
     */
    spindleOverride?: UABaseAnalog<UInt32, DataType.UInt32>;
}
export interface UAIWwUnitValues extends UABaseInterface, UAIWwUnitValues_Base {
}