// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32, Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAISensor_calibrationInformation extends UAFolder { // Object
      /**
       * calibrationDate
       * The mandatory CalibrationDate is the date when
       * the last calibration took place.
       */
      calibrationDate: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * calibrationPlace
       * The optional CalibrationPlace is the location
       * where the last calibration took place.
       */
      calibrationPlace?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * certificateUri
       * The optional CertificateUri contains the URI of a
       * certificate of the calibration target in case the
       * calibration target is certified and the
       * information available. Otherwise, the Property
       * should be omitted. The String shall be a URI as
       * defined by RFC 3986. Example: MCE test document.
       */
      certificateUri?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * nextCalibrationDate
       * The optional NextCalibrationDate is the date of
       * the next planned calibration.
       */
      nextCalibrationDate?: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * sensorScale
       * The optional SensorScale is the nominal scale of
       * the sensor. It corresponds also with the
       * measurement range of the sensor.
       */
      sensorScale?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * value
       * The optional Value is the actual measured value
       * of the sensor.
       */
      value?: UAJoiningDataVariable<number, DataType.Double>;
}
export interface UAISensor_parameters extends UAFolder { // Object
      /**
       * overloadCount
       * The optional OverloadCount is the number of
       * overloads of the sensor, where the permissible
       * load of the senor was exceeded.
       */
      overloadCount?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * type
       * The optional Type is the classification of a
       * Sensor.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:ISensorType ns=14;i=1011                       |
 * |isAbstract      |true                                              |
 */
export interface UAISensor_Base extends UAITighteningSystemAsset_Base {
    /**
     * calibrationInformation
     * The optional CalibrationInformation Object is the
     * general information about the calibration
     * performed on the given sensor.
     */
    calibrationInformation?: UAISensor_calibrationInformation;
    parameters: UAISensor_parameters;
}
export interface UAISensor extends UAITighteningSystemAsset, UAISensor_Base {
}