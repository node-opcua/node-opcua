// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |JobResult                                                   |
 * | isAbstract|false                                                       |
 */
export enum EnumJobResult  {
  /**
   * Unknown state. Used when result is not known,
   * e.g. because job order is still running.
   */
  Unknown = 0,
  /**
   * Job order was executed successful
   */
  Successful = 1,
  /**
   * Job order was not executed successful.
   */
  Unsuccessful = 2,
}