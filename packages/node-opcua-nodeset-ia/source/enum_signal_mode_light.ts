// ----- this file has been automatically generated - do not edit

/**
 * Contains the values used to indicate in what way
 * a lamp behaves when switched on.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IA/                   |
 * | nodeClass |DataType                                          |
 * | name      |9:SignalModeLight                                 |
 * | isAbstract|false                                             |
 */
export enum EnumSignalModeLight  {
  /**
   * This value indicates a continuous light.
   */
  Continuous = 0,
  /**
   * This value indicates a blinking light (blinking
   * in regular intervals with equally long on and off
   * times).
   */
  Blinking = 1,
  /**
   * This value indicates a flashing light (blinking
   * in intervals with longer off times than on times,
   * per interval multiple on times are possible).
   */
  Flashing = 2,
  /**
   * The light is handled in a way not defined in this
   * version of the specification.
   */
  Other = 3,
}