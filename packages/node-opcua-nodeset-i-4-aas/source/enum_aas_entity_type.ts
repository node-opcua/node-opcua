// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/I4AAS/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AASEntityTypeDataType                                       |
 * | isAbstract|false                                                       |
 */
export enum EnumAASEntityType  {
  /**
   * Self-Managed Entities have their own AAS. This is
   * why a reference to this asset is specified as
   * well (Entity/asset). Additionally, further
   * property statements (compare to [15]) can be
   * added to the asset that are not specified in the
   * AAS of the asset itself because they are
   * specified in relation to the complex I4.0
   * Component only.
   */
  CoManagedEntity = 0,
  /**
   * For co-managed entities there is no separate AAS.
   * The relationships and property statements of such
   * entities are managed within the AAS of the
   * composite I4.0 Component.
   */
  SelfManagedEntity = 1,
}