// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TsnListenerStatus                                 |
 * | isAbstract|false                                             |
 */
export enum EnumTsnListenerStatus  {
  /**
   * No Listener detected.
   */
  None = 0,
  /**
   * Listener ready (configured).
   */
  Ready = 1,
  /**
   * One or more Listeners ready, and one or more
   * Listeners failed.
   */
  PartialFailed = 2,
  /**
   * Listener failed.
   */
  Failed = 3,
}