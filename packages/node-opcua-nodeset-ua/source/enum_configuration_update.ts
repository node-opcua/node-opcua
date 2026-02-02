// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ConfigurationUpdateType                                     |
 * | isAbstract|false                                                       |
 */
export enum EnumConfigurationUpdate  {
  /**
   * The target is added. An error occurs if a name
   * conflict occurs.
   */
  Insert = 1,
  /**
   * Existing records are updated. An error occurs if
   * a name cannot be matched to an existing record.
   */
  Replace = 2,
  /**
   * Existing records are updated. New records are
   * created if no match to an exising record.
   */
  InsertOrReplace = 3,
  /**
   * Existing records are deleted. An error occurs if
   * a name cannot be matched to an existing record.
   */
  Delete = 4,
}