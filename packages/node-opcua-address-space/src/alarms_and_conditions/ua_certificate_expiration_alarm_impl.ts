/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { Certificate, exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto";
import { DateTime, minOPCUADate } from "node-opcua-basic-types";
import { make_warningLog } from "node-opcua-debug";
import { DataType, VariantOptions } from "node-opcua-variant";
import { UACertificateExpirationAlarm_Base } from "node-opcua-nodeset-ua";
import { INamespace } from "node-opcua-address-space-base";
import { UASystemOffNormalAlarmImpl } from "./ua_system_off_normal_alarm_impl";
import { InstantiateOffNormalAlarmOptions } from "./ua_off_normal_alarm_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

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
    > {
    getExpirationDate(): DateTime;
    setExpirationDate(value: Date): void;
    getExpirationLimit(): number;
    setExpirationLimit(value: number): void;
    setCertificate(certificate: Certificate | null): void;
    getCertificate(): Certificate | null;
}

export declare interface UACertificateExpirationAlarmImpl extends UACertificateExpirationAlarmEx, UASystemOffNormalAlarmImpl {}
/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server’s
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
export class UACertificateExpirationAlarmImpl extends UASystemOffNormalAlarmImpl implements UACertificateExpirationAlarmEx {
    public static instantiate(
        namespace: INamespace,
        alarmType: "CertificateExpirationAlarmType",
        options: InstantiateOffNormalAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UACertificateExpirationAlarmImpl {
        const alarm = UASystemOffNormalAlarmImpl.instantiate(
            namespace,
            alarmType || "CertificateExpirationAlarmType",
            options,
            data
        ) as UACertificateExpirationAlarmImpl;
        Object.setPrototypeOf(alarm, UACertificateExpirationAlarmImpl.prototype);
        return alarm;
    }

    public getExpirationDate(): DateTime {
        return this.expirationDate.readValue().value.value;
    }

    public setExpirationDate(value: Date): void {
        this.expirationDate.setValueFromSource({
            dataType: DataType.DateTime,
            value
        });
        const now = new Date();
        const expirationLimit = this.getExpirationLimit();
        const thumbprint = makeSHA1Thumbprint(this.getCertificate() || Buffer.alloc(0)).toString("hex");

        if (value.getTime() <= now.getTime() - expirationLimit) {
            if (!this.currentBranch().getActiveState()) {
                warningLog(`CertificateExpirationAlarm:  becomes active, certificate ${thumbprint} endDate ${value.toUTCString()}`);
            }
            // also raise the event
            if (value.getTime() <= now.getTime()) {
                this.updateAlarmState(true, `certificate ${thumbprint} has expired : end date is ${value.toUTCString()}`);
            } else {
                this.updateAlarmState(true, `certificate ${thumbprint} is about to expire : end date is ${value.toString()}`);
            }
        } else {
            if (this.currentBranch().getActiveState()) {
                warningLog(
                    `CertificateExpirationAlarm:  becomes desactivated, certificate ${thumbprint} endDate ${value.toUTCString()}`
                );
            }
            // also raise the event
            this.updateAlarmState(false, "");
        }
    }

    public getExpirationLimit(): number {
        return (this.expirationLimit?.readValue().value.value as number) || 0;
    }

    public setExpirationLimit(value: number): void {
        this.expirationLimit?.setValueFromSource({
            dataType: DataType.Double,
            value
        });
        // make sure we re-evaluate the certificfate
        const certificate = this.getCertificate();
        this.setCertificate(certificate);
    }

    public getCertificate(): Certificate | null {
        return (this.certificate.readValue().value.value as Certificate | null) || null;
    }

    public setCertificate(certificate: Certificate | null): void {
        if (certificate) {
            const info = exploreCertificate(certificate);
            if (info.tbsCertificate.validity.notAfter instanceof Date) {
                this.setExpirationDate(info.tbsCertificate.validity.notAfter);
            } else {
                this.setExpirationDate(minOPCUADate);
            }
        } else {
            this.setExpirationDate(minOPCUADate);
        }
        this.certificate.setValueFromSource({
            dataType: DataType.ByteString,
            value: certificate
        });
    }
}
