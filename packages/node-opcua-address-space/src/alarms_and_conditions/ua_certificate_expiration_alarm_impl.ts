/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { Certificate, exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto";
import { DateTime, minOPCUADate } from "node-opcua-basic-types";
import { make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { DataType, VariantOptions } from "node-opcua-variant";
import { INamespace, UAObject, UAProperty } from "node-opcua-address-space-base";
import { ObjectTypeIds } from "node-opcua-constants";
import { makeAccessLevelExFlag } from "node-opcua-data-model";
import { UACertificateExpirationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_certificate_expiration_alarm_ex";
import { InstantiateOffNormalAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { UASystemOffNormalAlarmImpl } from "./ua_system_off_normal_alarm_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

export function instantiateCertificateExpirationAlarm(
    namespace: INamespace,
    alarmType: "CertificateExpirationAlarmType",
    options: InstantiateOffNormalAlarmOptions,
    data?: Record<string, VariantOptions>

): UACertificateExpirationAlarmEx {
    return UACertificateExpirationAlarmImpl.instantiate(namespace,alarmType, options, data);
}


interface UACertificateExpirationAlarmImpl {
    expirationDate: UAProperty<Date, /*z*/DataType.DateTime>;
    expirationLimit?: UAProperty<number, /*z*/DataType.Double>;
    certificateType: UAProperty<NodeId, /*z*/DataType.NodeId>;
    certificate: UAProperty<Buffer, /*z*/DataType.ByteString>;
}
/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server’s
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
class UACertificateExpirationAlarmImpl extends UASystemOffNormalAlarmImpl implements UACertificateExpirationAlarmEx {


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
        alarm._post_initialize();
        return alarm;
    }

    public getExpirationDate(): DateTime {
        return this.expirationDate.readValue().value.value;
    }

    public setExpirationDate(expirationDate: Date): void {
        this.expirationDate.setValueFromSource({
            dataType: DataType.DateTime,
            value: expirationDate
        });
        const now = new Date();
        const expirationLimit = this.getExpirationLimit();

        const checkDate = new Date(now.getTime() + +expirationLimit);

        const thumbprint = makeSHA1Thumbprint(this.getCertificate() || Buffer.alloc(0)).toString("hex");

        if (expirationDate.getTime() <= checkDate.getTime()) {
            if (!this.currentBranch().getActiveState()) {
                warningLog(
                    `CertificateExpirationAlarm:  becomes active, certificate ${thumbprint} endDate ${expirationDate.toUTCString()} checkDate=${checkDate.toUTCString()} expirationLimit=${expirationLimit}`
                );
            }
            // also raise the event
            if (expirationDate.getTime() <= now.getTime()) {
                this.updateAlarmState(
                    true,
                    `certificate ${thumbprint} has expired : end date is ${expirationDate.toUTCString()} checkDate=${checkDate.toUTCString()}  expirationLimit=${expirationLimit}`
                );
            } else {
                this.updateAlarmState(
                    true,
                    `certificate ${thumbprint} is about to expire : end date is ${expirationDate.toString()} checkDate=${checkDate.toUTCString()}  expirationLimit=${expirationLimit}`
                );
            }
        } else {
            if (this.currentBranch().getActiveState()) {
                warningLog(
                    `CertificateExpirationAlarm:  becomes desactivated, certificate ${thumbprint} endDate ${expirationDate.toUTCString()} expirationLimit=${expirationLimit}`
                );
            }
            // also raise the event
            this.updateAlarmState(
                false,
                `certificate ${thumbprint} end date is OK: ${expirationDate.toString()} , expirationLimit=${expirationLimit}`
            );
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
    }

    public getCertificate(): Certificate | null {
        return (this.certificate.readValue().value.value as Certificate | null) || null;
    }

    public setCertificate(certificate: Certificate | null): void {
        if (certificate && certificate.length > 0) {
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

    _post_initialize() {
        if (this.expirationLimit) {
            this.expirationLimit.accessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.userAccessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.on("value_changed", (dataValue) => {
                // make sure we re-evaluate the certificfate
                const certificate = this.getCertificate();
                this.setCertificate(certificate);
            });
        }
    }
}

export function promoteToCertificateExpirationAlarm(node: UAObject): UACertificateExpirationAlarmImpl {
    if (node instanceof UACertificateExpirationAlarmImpl) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UACertificateExpirationAlarmImpl.prototype);
    const _node = node as unknown as UACertificateExpirationAlarmImpl;
    _node._post_initialize();
    return _node;
}
registerNodePromoter(ObjectTypeIds.CertificateExpirationAlarmType, promoteToCertificateExpirationAlarm);
