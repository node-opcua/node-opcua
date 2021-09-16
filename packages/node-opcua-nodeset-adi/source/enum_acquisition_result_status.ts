// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ADI/                  |
 * | nodeClass |DataType                                          |
 * | name      |2:AcquisitionResultStatusEnumeration              |
 * | isAbstract|false                                             |
 */
export enum EnumAcquisitionResultStatus  {
  /**
   * No longer used.
   */
  NOT_USED = 0,
  /**
   * The acquisition has been completed as requested
   * without any error.
   */
  GOOD = 1,
  /**
   * The acquisition has been completed as requested
   * with error.
   */
  BAD = 2,
  /**
   * The acquisition has been completed but nothing
   * can be said about the quality of the result.
   */
  UNKNOWN = 3,
  /**
   * The acquisition has been partially completed as
   * requested without any error.
   */
  PARTIAL = 4,
}