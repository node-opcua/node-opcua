// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:SystemStateDataType                             |
 * | isAbstract|false                                             |
 */
export enum EnumSystemState  {
  /**
   * Production: The vision system is currently
   * working on a job.
   */
  PRD_1 = 1,
  /**
   * Stand by: The vision system is ready to accept a
   * command but is currently not executing a job. It
   * could for example be waiting for a Start command
   * or a user input.
   */
  SBY_2 = 2,
  /**
   * Engineering: The vision system is not working and
   * not ready to accept a command because a user is
   * currently working on the system.  This could be
   * for editing a recipe or changing the system
   * configuration.
   */
  ENG_3 = 3,
  /**
   * Scheduled downtime: The vision system is not
   * available for production and this was planned in
   * advance. This could be for cleaning, maintenance
   * or calibration works.
   */
  SDT_4 = 4,
  /**
   * Unscheduled downtime: The vision system is not
   * available for production due to failure and
   * repair. This covers all kinds of error states
   * that might occur during operation.
   */
  UDT_5 = 5,
  /**
   * Nonscheduled time: The vision system is not
   * working because no production was scheduled. This
   * also covers things like operator training on the
   * system.
   */
  NST_6 = 6,
}