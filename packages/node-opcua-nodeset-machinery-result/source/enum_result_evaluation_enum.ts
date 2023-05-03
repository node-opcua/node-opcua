// ----- this file has been automatically generated - do not edit

/**
 * Indicates whether a result was in tolerance
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/               |
 * | nodeClass |DataType                                                    |
 * | name      |21:ResultEvaluationEnum                                     |
 * | isAbstract|false                                                       |
 */
export enum EnumResultEvaluationEnum  {
  /**
   * The evaluation of the result is unknown, for
   * example because it failed
   */
  Undefined = 0,
  /**
   * The result is in tolerance
   */
  OK = 1,
  /**
   * The result is out of tolerance
   */
  NotOK = 2,
  /**
   * The decision is not possible due to measurement
   * uncertainty.
   */
  NotDecidable = 3,
}