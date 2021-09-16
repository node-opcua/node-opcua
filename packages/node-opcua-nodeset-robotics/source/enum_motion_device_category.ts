// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Robotics/             |
 * | nodeClass |DataType                                          |
 * | name      |7:MotionDeviceCategoryEnumeration                 |
 * | isAbstract|false                                             |
 */
export enum EnumMotionDeviceCategory  {
  /**
   * Any MotionDevice which is not defined by the
   * MotionDeviceCategoryEnumeration.
   */
  OTHER = 0,
  /**
   * This robot design features rotary joints and can
   * range from simple two joint structures to 10 or
   * more joints. The arm is connected to the base
   * with a twisting joint. The links in the arm are
   * connected by rotary joints.
   */
  ARTICULATED_ROBOT = 1,
  /**
   * The robot has two parallel rotary joints that
   * ensure compliance in a specified plane.
   */
  SCARA_ROBOT = 2,
  /**
   * Cartesian robots have three linear joints that
   * use the Cartesian coordinate system (X, Y, and
   * Z). They also may have an attached wrist to allow
   * for rotational movement. The three prismatic
   * joints provide linear movement along the axis.
   */
  CARTESIAN_ROBOT = 3,
  /**
   * The arm is connected to the base with a twisting
   * joint and a combination of two rotary joints and
   * one linear joint. The axes form a polar
   * coordinate system and create a spherical shaped
   * work envelope.
   */
  SPHERICAL_ROBOT = 4,
  /**
   * These spider like robots are built from jointed
   * parallelograms connected to a common base. The
   * parallelograms move a single EOAT in a
   * dome-shaped work area.
   */
  PARALLEL_ROBOT = 5,
  /**
   * The robot has at least one rotary joint at the
   * base and at least one prismatic joint to connect
   * the links. The rotary joint uses a rotational
   * motion along the joint axis, while the prismatic
   * joint moves in a linear motion. Cylindrical
   * robots operate within a cylindrical-shaped work
   * envelope.
   */
  CYLINDRICAL_ROBOT = 6,
}