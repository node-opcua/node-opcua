/**
 * @module opcua.address_space.AlarmsAndConditions
 */

/**
 * @class UACertificateExpirationAlarm
 * @extends UASystemOffNormalAlarm
 * @constructor
 * This SystemOffNormalAlarmType is raised by the Server when the Server’s Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
class UACertificateExpirationAlarm {
  getExpirationDate() {
    return this.expirationDate.readValue().value.value;
  }

  getExpirationDate(value) {
    return this.expirationDate.setValueFromSource({ dataType: DataType.DateTime, value });
  }
}

util.inherits(UACertificateExpirationAlarm, UASystemOffNormalAlarm);

