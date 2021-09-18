/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { DateTime } from "node-opcua-basic-types";
import { DataType } from "node-opcua-variant";
import { UACertificateExpirationAlarm, UACertificateExpirationAlarm_Base } from "node-opcua-nodeset-ua";
import { INamespace } from "node-opcua-address-space-base";
import { UASystemOffNormalAlarmImpl } from "./ua_system_off_normal_alarm_impl";

export interface UACertificateExpirationAlarmEx
    extends Omit<
        UACertificateExpirationAlarm_Base,
        | "ackedState"
        | "activeState"
        | "confirmedState"
        | "enabledState"
        | "latchedState"
        | "limitState"
        | "outOfServiceState"
        | "shelvingState"
        | "silenceState"
        | "suppressedState"
    > {}
export declare interface UACertificateExpirationAlarmImpl extends UACertificateExpirationAlarmEx, UASystemOffNormalAlarmImpl {}
/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server’s
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
export class UACertificateExpirationAlarmImpl extends UASystemOffNormalAlarmImpl implements UACertificateExpirationAlarmEx {
    public static instantiate(namespace: INamespace, options: any, data: any): UACertificateExpirationAlarmImpl {
        return UASystemOffNormalAlarmImpl.instantiate(
            namespace,
            "CertificateExpirationAlarmType",
            options,
            data
        ) as UACertificateExpirationAlarmImpl;
    }

    public getExpirationDate(): DateTime {
        return this.expirationDate.readValue().value.value;
    }

    public setExpirationDate(value: Date): void {
        return this.expirationDate.setValueFromSource({
            dataType: DataType.DateTime,
            value
        });
    }
}
