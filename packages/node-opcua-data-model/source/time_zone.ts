/**
 * @module node-opcua-data-model
 */
// tslint:disable:no-bitwise

/*
 *  This Structured DataType defines the local time that may or may not take daylight saving time
 *  into account. Its elements are described in Table 24.
 *  Table 24 – TimeZoneDataType Definition
 *  Name                       Type       Description
 *  TimeZoneDataType structure
 *  offset                     Int16     The offset in minutes from UtcTime
 *  daylightSavingInOffset     Boolean   If TRUE, then daylight saving time (DST) is in effect and offset
 *                                       includes the DST correction. If FALSE then the offset does not
 *                                       include the DST correction and DST may or may not have
 *                                       been in effect.
 */
// todo : repair exports.TimeZoneDataType = require("./_generated_/_tuto").TimeZoneDataType;
