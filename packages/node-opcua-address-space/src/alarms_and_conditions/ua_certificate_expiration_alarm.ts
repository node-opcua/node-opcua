/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { DateTime } from "node-opcua-basic-types";
import { Certificate } from "node-opcua-crypto";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

import {
    Duration,
    Namespace,
    UAVariableT,
} from "../../source";
import { UASystemOffNormalAlarm } from "./ua_system_off_normal_alarm";

/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server’s
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 *
 * @class UACertificateExpirationAlarm
 * @extends UASystemOffNormalAlarm
 * @constructor
 *
 *
 */
export class UACertificateExpirationAlarm extends UASystemOffNormalAlarm {

    public static instantiate(
        namespace: Namespace,
        options: any,
        data: any
    ): UACertificateExpirationAlarm {
        return UASystemOffNormalAlarm.instantiate(
          namespace,
          "CertificateExpirationAlarmType",
          options, data) as UACertificateExpirationAlarm;
    }

    public getExpirationDate(): DateTime {
        return this.expirationDate.readValue().value.value;
    }

    public setExpirationDate(value: Date) {
        return this.expirationDate.setValueFromSource({
            dataType: DataType.DateTime,
            value
        });
    }
}
export interface UACertificateExpirationAlarm {
    /**
     * ExpirationDate is the date and time this certificate will expire.
     * HasProperty Variable ExpirationDate  DateTime   PropertyType Mandatory
     */
    expirationDate: UAVariableT<DateTime, DataType.DateTime>;

    // ExpirationLimit is the time interval before the ExpirationDate at which this alarm will trigger.
    //  This shall be a positive number. If the property is not provided, a default of 2 weeks shall be used.
    // HasProperty Variable ExpirationLimit Duration   PropertyType Optional
    expirationLimit?: UAVariableT<Duration, DataType.Double>;

    // CertificateType – See Part 12 for definition of CertificateType.
    // HasProperty Variable CertificateType NodeId     PropertyType Mandatory
    certificateType: UAVariableT<NodeId, DataType.NodeId>;

    //  Certificate is the certificate that is about to expire.
    // HasProperty Variable Certificate     ByteString PropertyType Mandatory
    certificate: UAVariableT<Certificate, DataType.ByteString>;
}
