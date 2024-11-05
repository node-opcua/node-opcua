// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/                    |
 * | nodeClass |DataType                                                    |
 * | name      |MachineOperationMode                                        |
 * | isAbstract|false                                                       |
 */
export enum EnumMachineOperationMode  {
  /**
   * The machine tool is controlled manually, by the
   * operator. Depending on technology specific norms,
   * the maximum axis movement speeds of the machine
   * tool are limited.
   */
  Manual = 0,
  /**
   * Operating mode for the automatic, programmed and
   * continuous operation of the machine. Manual
   * loading and unloading workpieces are possible
   * when the automatic program is stopped. Axis
   * movement speeds are fully available to the
   * machine tool’s ability.
   */
  Automatic = 1,
  /**
   * Depending on technology specific norms, the
   * maximum axis movement speeds of the machine tool
   * are limited. In this mode, the operator can make
   * settings for the subsequent work processes.
   */
  Setup = 2,
  /**
   * Operating mode with the possibility of manual
   * interventions in the machining process as well as
   * limited automatic operation started by the
   * operator. Depending on technology specific norms,
   * the maximum axis movement speeds of the machine
   * tool are limited.
   */
  AutoWithManualIntervention = 3,
  /**
   * Operating mode for service purposes. This mode
   * shall not be used for manufacturing any parts.
   * This mode shall only be used by authorized
   * personnel.
   */
  Service = 4,
  /**
   * The machine operation mode is different from the
   * values defined in this enumeration.
   */
  Other = 5,
}