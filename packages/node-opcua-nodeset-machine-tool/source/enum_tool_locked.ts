// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:ToolLocked                                     |
 * | isAbstract|false                                             |
 */
export enum EnumToolLocked  {
  /**
   * The reason for locking the tool cannot be given.
   */
  CapabilityUnavailable = 0,
  /**
   * The tool is locked by an operator.
   */
  ByOperator = 1,
  /**
   * The tool is locked because a tool break has been
   * detected.
   */
  ToolBreak = 2,
  /**
   * The tool is locked because it reached a tool life
   * limit.
   */
  ToolLife = 3,
  /**
   * The tool is locked due to a measurement error of
   * the tool.
   */
  MeasurementError = 4,
  /**
   * The tool is locked for another reason.
   */
  Other = 5,
}