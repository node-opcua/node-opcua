// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |AssetVerificationModeEnum                                   |
 * | isAbstract|false                                                       |
 */
export enum EnumAssetVerificationModeEnum  {
  /**
   * Verify whether an Asset’s functionality matches
   * or is compatible to the expectation of system
   * engineering.
   */
  AssetCompatibility = 0,
  /**
   * Verify whether an Asset’s identity meets the
   * expectation of system engineering.
   */
  AssetIdentity = 1,
  /**
   * Verify whether an Asset’s identity meets the
   * expectation of system engineering and whether its
   * functionality matches or is compatible to the
   * expectation of system engineering.
   */
  AssetIdentityAndCompatibility = 2,
}