// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Robotics/             |
 * | nodeClass |DataType                                          |
 * | name      |7:AxisMotionProfileEnumeration                    |
 * | isAbstract|false                                             |
 */
export enum EnumAxisMotionProfile  {
  /**
   * Any motion-profile which is not defined by the
   * AxisMotionProfileEnumeration.
   */
  OTHER = 0,
  /**
   * Rotary motion is a rotation along a circular path
   * with defined limits. Motion movement is not going
   * always in the same direction. Control unit is
   * mainly degree.
   */
  ROTARY = 1,
  /**
   * Rotary motion is a rotation along a circular path
   * with no limits. Motion movement is going endless
   * in the same direction. Control unit is mainly
   * degree.
   */
  ROTARY_ENDLESS = 2,
  /**
   * Linear motion is a one dimensional motion along a
   * straight line with defined limits. Motion
   * movement is not going always in the same
   * direction. Control unit is mainly mm.
   */
  LINEAR = 3,
  /**
   * Linear motion is a one dimensional motion along a
   * straight line with no limits. Motion movement is
   * going endless in the same direction. Control unit
   * is mainly mm.
   */
  LINEAR_ENDLESS = 4,
}