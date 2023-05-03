// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |3:AutoIdOperationStatusEnumeration                          |
 * | isAbstract|false                                                       |
 */
export enum EnumAutoIdOperationStatus  {
  /**
   * Successful operation
   */
  SUCCESS = 0,
  /**
   * The operation has not be executed in total.
   */
  MISC_ERROR_TOTAL = 1,
  /**
   * The operation has been executed only partial.
   */
  MISC_ERROR_PARTIAL = 2,
  /**
   * Password required
   */
  PERMISSON_ERROR = 3,
  /**
   * Password is wrong.
   */
  PASSWORD_ERROR = 4,
  /**
   * Memory region not available for the actual tag.
   */
  REGION_NOT_FOUND_ERROR = 5,
  /**
   * Operation not supported by the actual tag.
   */
  OP_NOT_POSSIBLE_ERROR = 6,
  /**
   * Addressed memory not available for the actual tag.
   */
  OUT_OF_RANGE_ERROR = 7,
  /**
   * The operation cannot be executed because no tag
   * or code was inside the range of the AutoID Device
   * or the tag or code has been moved out of the
   * range during execution.
   */
  NO_IDENTIFIER = 8,
  /**
   * Multiple tags or codes have been selected, but
   * the command can only be used with a single tag or
   * code.
   */
  MULTIPLE_IDENTIFIERS = 9,
  /**
   * The tag or code exists and has a valid format,
   * but there was a problem reading the data (e.g.
   * still CRC error after maximum number of retries).
   */
  READ_ERROR = 10,
  /**
   * The (optical) code or plain text has too many
   * failures and cannot be detected.
   */
  DECODING_ERROR = 11,
  /**
   * The code doesn’t match the given target value.
   */
  MATCH_ERROR = 12,
  /**
   * The code format is not supported by the AutoID
   * Device.
   */
  CODE_NOT_SUPPORTED = 13,
  /**
   * The tag exists, but there was a problem writing
   * the data.
   */
  WRITE_ERROR = 14,
  /**
   * The command or a parameter combination is not
   * supported by the AutoID Device.
   */
  NOT_SUPPORTED_BY_DEVICE = 15,
  /**
   * The command or a parameter combination is not
   * supported by the tag.
   */
  NOT_SUPPORTED_BY_TAG = 16,
  /**
   * The AutoID Device is in a state not ready to
   * execute the command.
   */
  DEVICE_NOT_READY = 17,
  /**
   * The AutoID Device configuration is not valid.
   */
  INVALID_CONFIGURATION = 18,
  /**
   * This error indicates that there is a general
   * error in the communication between the
   * transponder and the reader.
   */
  RF_COMMUNICATION_ERROR = 19,
  /**
   * The AutoID Device has a hardware fault.
   */
  DEVICE_FAULT = 20,
  /**
   * The battery of the (active) tag is low.
   */
  TAG_HAS_LOW_BATTERY = 21,
}