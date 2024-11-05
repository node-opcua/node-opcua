// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * This structure contains the Calibration
 * information. It is used as an input argument in
 * SetCalibration method.
 * Note: The input data sent in SetCalibration shall
 * be updated in the respective parameters of the
 * asset under Maintenance/Calibration.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |CalibrationDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTCalibration extends DTStructure {
  /** It is the date when the last calibration took place.
Note: It can have the initial operation date for a new asset if it is not available.*/
  lastCalibration: Date; // DateTime ns=0;i=294
  /** It is the location where the last calibration took place.*/
  calibrationPlace?: UAString; // String ns=0;i=12
  /** It is the date of the next planned calibration.*/
  nextCalibration?: Date; // DateTime ns=0;i=294
  /** It is the actual measured value of the calibration.*/
  calibrationValue?: number; // Double ns=0;i=11
  /** It is the nominal scale of the sensor. It corresponds also with the measurement range of the sensor.*/
  sensorScale?: number; // Double ns=0;i=11
  /** It contains the URI of a certificate of the calibration target in case the calibration target is certified and the information available. Otherwise, the Variable should be omitted. The String shall be a URI as defined by RFC 3986. 
Example: MCE test document.*/
  certificateUri?: UAString; // String ns=0;i=23751
  /** It defines the engineering unit of the value.*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTCalibration extends ExtensionObject, DTCalibration {};