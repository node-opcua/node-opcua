// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:ToolManagement                                 |
 * | isAbstract|false                                             |
 */
export enum EnumToolManagement  {
  /**
   * The tool is addressed using a single identifier.
   */
  NumberBased = 0,
  /**
   * The tool is addressed using an identifier for the
   * group and a second one for the tool within the
   * group.
   */
  GroupBased = 1,
  /**
   * The tool is addressed by a different, custom
   * defined system.
   */
  Other = 2,
}