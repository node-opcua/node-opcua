// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * The IWwUnitFlagsType represents the flags of a
 * unit
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwUnitFlagsType ns=12;i=4                     |
 * |isAbstract      |true                                              |
 */
export interface UAIWwUnitFlags_Base extends UABaseInterface_Base {
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
    error: UABaseDataVariable<boolean, DataType.Boolean>;
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
    loadingEnabled?: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * machineInitialized
     * The MachineInitialized Variable is true if the
     * MachineOn is true, the plc and the control
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
     * The PowerPresent Variable is true if 400V are
     * present (the drives are ready to move).
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
     * runs its program. This is only possible if the
     * Error Variable is false. However, if the machine
     * is paused by the program, the machine is
     * considered to still be running its program, i.e.
     * while the RecipeInHold Variable is true, the
     * RecipeInRun cannot be false.
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
export interface UAIWwUnitFlags extends UABaseInterface, UAIWwUnitFlags_Base {
}