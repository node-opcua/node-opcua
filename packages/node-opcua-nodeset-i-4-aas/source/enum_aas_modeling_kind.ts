// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/I4AAS/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AASModelingKindDataType                                     |
 * | isAbstract|false                                                       |
 */
export enum EnumAASModelingKind  {
  /**
   * Hardware or software element which specifies the
   * common attributes shared by all instances of the
   * type
   * [SOURCE: IEC TR 62390:2005-01, 3.1.25]
   */
  Template = 0,
  /**
   * Concrete, clearly identifiable component of a
   * certain template. 
   * 
   * Note: It becomes an individual entity of a
   * template, for example a device model, by defining
   * specific property values. 
   * 
   * Note: In an object oriented view, an instance
   * denotes an object of a template (class). 
   * 
   * [SOURCE: IEC 62890:2016, 3.1.16 65/617/CDV]
   * modified
   */
  Instance = 1,
}