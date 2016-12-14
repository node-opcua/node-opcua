"use strict";
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
function UACertificateExpirationAlarm() {

    /**
     * @property expirationDate
     * @type UAVariableT
     * ExpirationDate is the date and time this certificate will expire.
     */
    // HasProperty Variable ExpirationDate  DateTime   PropertyType Mandatory


    // ExpirationLimit is the time interval before the ExpirationDate at which this alarm will trigger.
    //  This shall be a positive number. If the property is not provided, a default of 2 weeks shall be used.
    // HasProperty Variable ExpirationLimit Duration   PropertyType Optional


    // CertificateType – See Part 12 for definition of CertificateType.
    // HasProperty Variable CertificateType NodeId     PropertyType Mandatory

    //  Certificate is the certificate that is about to expire.
    // HasProperty Variable Certificate     ByteString PropertyType Mandatory

}
util.inherits(UACertificateExpirationAlarm, UASystemOffNormalAlarm);

UACertificateExpirationAlarm.prototype.getExpirationDate = function()
{
    return this.expirationDate.readValue().value.value;
};
UACertificateExpirationAlarm.prototype.getExpirationDate = function(value)
{
    return this.expirationDate.setValueFromSource({dataType: DataType.DateTime, value: value});
};

