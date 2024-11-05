// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |JobExecutionMode                                            |
 * | isAbstract|false                                                       |
 */
export enum EnumJobExecutionMode  {
  /**
   * Machine running in simulation mode with no
   * workpiece involved.
   */
  SimulationMode = 0,
  /**
   * Machine running in test mode with a workpiece
   * involved.
   */
  TestMode = 1,
  /**
   * Machine running in production mode.
   */
  ProductionMode = 2,
}