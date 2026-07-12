// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/I4AAS/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AASAssetKindDataType                                        |
 * | isAbstract|false                                                       |
 */
export enum EnumAASAssetKind  {
  /**
   * hardware or software element which specifies the
   * common attributes shared by all instances of the
   * type
   * [SOURCE: IEC TR 62390:2005-01, 3.1.25]
   */
  Type = 0,
  /**
   * concrete, clearly identifiable component of a
   * certain type
   * 
   * Note: It becomes an individual entity of a type,
   * for example a device, by defining specific
   * property values.
   * 
   * Note: In an object-oriented view, an instance
   * denotes an object of a class (of a type).
   * 
   * [SOURCE: IEC 62890:2016, 3.1.16] 65/617/CDV
   */
  Instance = 1,
}