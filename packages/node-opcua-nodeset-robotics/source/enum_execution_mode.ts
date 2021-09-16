// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Robotics/             |
 * | nodeClass |DataType                                          |
 * | name      |7:ExecutionModeEnumeration                        |
 * | isAbstract|false                                             |
 */
export enum EnumExecutionMode  {
  /**
   * Single execution of a task program according to
   * ISO 8373.
   */
  CYCLE = 0,
  /**
   * Task program is executed continuously and starts
   * again automatically.
   */
  CONTINUOUS = 1,
  /**
   * Task program is executed in steps.
   */
  STEP = 2,
}