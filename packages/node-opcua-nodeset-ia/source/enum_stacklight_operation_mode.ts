// ----- this file has been automatically generated - do not edit

/**
 * Contains the values used to indicate how a
 * stacklight (as a whole unit) is used.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IA/                   |
 * | nodeClass |DataType                                          |
 * | name      |9:StacklightOperationMode                         |
 * | isAbstract|false                                             |
 */
export enum EnumStacklightOperationMode  {
  /**
   * Stacklight is used as stack of individual lights
   */
  Segmented = 0,
  /**
   * Stacklight is used as level meter
   */
  Levelmeter = 1,
  /**
   * The whole stack acts as a running light
   */
  Running_Light = 2,
  /**
   * Stacklight is used in a way not defined in this
   * version of the specification
   */
  Other = 3,
}