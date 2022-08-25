// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UABaseAnalog } from "node-opcua-nodeset-ua/source/ua_base_analog"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { EnumWwUnitMode } from "./enum_ww_unit_mode"
import { EnumWwUnitState } from "./enum_ww_unit_state"
export interface UAIWwBaseState_flags extends UAObject { // Object
      /**
       * airPresent
       * The AirPresent Variable is true if the air
       * pressure present in the machine.
       */
      airPresent?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * alarm
       * The Alarm Variable is true if at least one alarm
       * exists.
       */
      alarm: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * calibrated
       * The Calibrated Variable is true if all devices
       * are calibrated.
       */
      calibrated: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * dustChipSuction
       * The DustChipSuction Variable is true if the dust
       * and chip suction is ready.
       */
      dustChipSuction?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * emergency
       * The Emergency Variable is true if at least one
       * emergency button is pressed.
       */
      emergency: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * energySaving
       * The EnergySaving Variable is true if energy
       * saving is activated on the machine.
       */
      energySaving?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * error
       * The Error Variable is true if at least one reason
       * exists which prevents the machine from working.
       */
      error?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * externalEmergency
       * The ExternalEmergency Variable is true if there
       * is an emergency from the line controller.
       */
      externalEmergency?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * feedRuns
       * The FeedRuns Variable is true if the feed is
       * running on a throughfeed machine.
       */
      feedRuns?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * hold
       * The Hold Variable is true if the movements are
       * paused by the operator.
       */
      hold?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * loadingEnabled
       * The LoadingEnabled Variable is true if the unit
       * is ready to get the next new part. If this is
       * false no part can get into the unit.
       */
      loadingEnabled?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * machineInitialized
       * The MachineInitialized Variable is true if the
       * MachineOn is true, the PLC and the control
       * processes are running. The machine is ready for
       * usage for the operator.
       */
      machineInitialized: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * machineOn
       * The MachineOn Variable is true if the machine is
       * switched on. If the OPC UA Server runs on the
       * machine this value is always true.
       */
      machineOn: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * maintenanceRequired
       * The MaintenanceRequired Variable is true if
       * maintenance is required.
       */
      maintenanceRequired?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * manualActivityRequired
       * The ManualActivityRequired Variable is true if a
       * manual activity by the operator is required. The
       * RecipeInRun is not affected.
       */
      manualActivityRequired?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * moving
       * The Moving Variable is true if at least one axis
       * is moving.
       */
      moving?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * powerPresent
       * The PowerPresent Variable is true if the power
       * supply is present (the drives are ready to move).
       */
      powerPresent: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * recipeInHold
       * The RecipeInHold Variable is true if the machine
       * is paused by the program. This is only possible
       * if the RecipeInRun Variable is also true.
       */
      recipeInHold?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * recipeInRun
       * The RecipeInRun Variable is true if the machine
       * runs its program. However, if the machine is
       * paused by the program, the machine is considered
       * to still be running its program, i.e. while the
       * RecipeInHold Variable is true, the RecipeInRun
       * cannot be false.
       */
      recipeInRun: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * recipeInSetup
       * The RecipeInSetup Variable is true if the
       * RecipeInRun is true and the machine is in the
       * setup phase (example: automatic tool change).
       */
      recipeInSetup?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * remote
       * The Remote Variable is true if the machine is
       * working with programs sent by the supervisor or
       * other external application.
       */
      remote?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * safety
       * The Safety Variable is true if at least one
       * safety device (light curtain, safety mat, …) has
       * intervened.
       */
      safety?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * waitLoad
       * The WaitLoad Variable is true if the machine is
       * waiting for pieces.
       */
      waitLoad?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * waitUnload
       * The WaitUnload Variable is true if the machine is
       * waiting to unload pieces.
       */
      waitUnload?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * warning
       * The Warning Variable is true if at least one
       * warning exists.
       */
      warning: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * workpiecePresent
       * The WorkpiecePresent Variable is true if at least
       * one piece is inside the machine.
       */
      workpiecePresent?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAIWwBaseState_overview extends UAObject { // Object
      /**
       * currentMode
       * The CurrentMode Variable provides the generalized
       * mode of the unit.
       */
      currentMode: UABaseDataVariable<EnumWwUnitMode, DataType.Int32>;
      /**
       * currentState
       * The CurrentState Variable provides the
       * generalized state of the unit.
       */
      currentState: UABaseDataVariable<EnumWwUnitState, DataType.Int32>;
}
export interface UAIWwBaseState_values extends UAObject { // Object
      /**
       * absoluteErrorTime
       * The AbsoluteErrorTime Variable provides the
       * absolute time of the ERROR_4 state in msec.
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
       * absolute time of the READY_2 state in msec.
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
       * absolute time of the STANDBY_1 state in msec.
       */
      absoluteStandbyTime?: UABaseAnalog<UInt64, DataType.UInt64>;
      /**
       * absoluteWorkingTime
       * The AbsoluteWorkingTime Variable provides the
       * absolute time of the WORKING_3 state in msec.
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
/**
 * The IWwBaseStateType represents the state of an
 * unit. An unit can be a machine of part of a
 * machine.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwBaseStateType ns=12;i=6                     |
 * |isAbstract      |true                                              |
 */
export interface UAIWwBaseState_Base extends UABaseInterface_Base {
    /**
     * flags
     * The Flags Object provides the flags of the unit.
     */
    flags?: UAIWwBaseState_flags;
    /**
     * overview
     * The Overview Object provides a general state of
     * the unit.
     */
    overview: UAIWwBaseState_overview;
    /**
     * values
     * The Values Object provides the counters of the
     * unit.
     */
    values?: UAIWwBaseState_values;
}
export interface UAIWwBaseState extends UABaseInterface, UAIWwBaseState_Base {
}