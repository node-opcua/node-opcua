// ----- this file has been automatically generated - do not edit

/**
 * The program is a consequent sequence of control
 * instructions for a self-contained
 * application-oriented function (DIN 19237). For
 * bottling machines, bits or documented integer
 * numbers must be used for machine operation with
 * the following programs:
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Weihenstephan/                  |
 * | nodeClass |DataType                                                    |
 * | name      |WSProgramEnumerationType                                    |
 * | isAbstract|false                                                       |
 */
export enum EnumWSProgramEnumeration  {
  /**
   * A machine was turned on, but no program for a
   * special application function has been selected.
   * „Undefined“ may also be used to provide the
   * information that a machine is ready for action,
   * but not required („No Order, No Activity“)
   */
  "Undefined (No Program)" = 0,
  /**
   * The machine is functioning as designed by the
   * manufacturer.
   */
  Production = 1,
  /**
   * Although the machine is functioning as designed
   * by the manufacturer, it is running a start-up
   * pro-gram which ensures full production after a
   * warm-up period as stipulated by regulations or
   * for safe-ty considerations, or in conjunction
   * with container buffering machines.
   */
  "Start Up" = 2,
  /**
   * Although the machine is functioning as designed
   * by the manufacturer, it is running a stop program
   * which ensures production stop after a run-down
   * period as stipulated by regulations or for safety
   * considerations, or in conjunction with container
   * buffering machines.
   */
  "Run Down" = 4,
  /**
   * The machine is running the cleaning program. This
   * program can consist of program steps which can be
   * controlled independently of each another, for
   * example the program step “flush” for the filling
   * or closing machine, or the program step
   * “headspace disinfection” for the cleaning machine.
   */
  Clean = 8,
  /**
   * The machine is running the changeover program in
   * which automatic machine adjustments are made
   * depending on specific parameters.
   */
  Changeover = 16,
  /**
   * The machine is running the maintenance program in
   * which the maintenance and service work are
   * carried out.
   */
  Maintenance = 32,
  /**
   * The machine is running the break program. This
   * ensures there is start up of the machine in
   * accordance with regulations after a break.
   */
  Break = 64,
}