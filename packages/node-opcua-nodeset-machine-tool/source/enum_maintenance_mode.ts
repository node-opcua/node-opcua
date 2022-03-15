// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:MaintenanceMode                                |
 * | isAbstract|false                                             |
 */
export enum EnumMaintenanceMode  {
  /**
   * Machine is being serviced.
   */
  Service = 0,
  /**
   * Machine is being inspected.
   */
  Inspection = 1,
  /**
   * Machine is being repaired.
   */
  Repair = 2,
  /**
   * Machine is being upgraded.
   */
  Upgrade = 3,
  /**
   * The machine maintenance mode is different from
   * the values defined in this enumeration.
   */
  Other = 4,
}