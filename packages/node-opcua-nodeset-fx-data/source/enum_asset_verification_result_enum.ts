// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |AssetVerificationResultEnum                                 |
 * | isAbstract|false                                                       |
 */
export enum EnumAssetVerificationResultEnum  {
  /**
   * The verification result is not set.
   */
  NotSet = 0,
  /**
   * Asset matches expectation.
   */
  Match = 1,
  /**
   * Asset does not match expectation but is
   * compatible.
   */
  Compatible = 2,
  /**
   * Asset does not match expectation and is not
   * compatible.
   */
  Mismatch = 3,
}