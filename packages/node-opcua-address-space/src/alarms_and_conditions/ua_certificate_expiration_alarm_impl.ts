/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { Certificate, exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto";
import { DateTime, minOPCUADate, StatusCodes } from "node-opcua-basic-types";
import { make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { DataType, Variant, VariantOptions } from "node-opcua-variant";
import { INamespace, UAObject, UAProperty } from "node-opcua-address-space-base";
import { ObjectTypeIds } from "node-opcua-constants";
import { makeAccessLevelExFlag } from "node-opcua-data-model";
import { UACertificateExpirationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_certificate_expiration_alarm_ex";
import { InstantiateOffNormalAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { UASystemOffNormalAlarmImpl } from "./ua_system_off_normal_alarm_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

const ellipsis = (arg0: string, arg1 = 4) => {
    arg1 = Math.max(arg1, 4);
    return arg0.length <= arg1 ? arg0 : arg0.slice(0, arg1 / 2) + "..." + arg0.slice(arg0.length - arg1 / 2);
};
const d = (d: Date) => {
    return d.toISOString();
};
export function instantiateCertificateExpirationAlarm(
    namespace: INamespace,
    alarmType: "CertificateExpirationAlarmType",
    options: InstantiateOffNormalAlarmOptions
): UACertificateExpirationAlarmEx {
    return UACertificateExpirationAlarmImpl.instantiate(namespace, alarmType, options);
}

interface UACertificateExpirationAlarmImpl {
    expirationDate: UAProperty<Date, /*z*/ DataType.DateTime>;
    expirationLimit?: UAProperty<number, /*z*/ DataType.Double>;
    certificateType: UAProperty<NodeId, /*z*/ DataType.NodeId>;
    certificate: UAProperty<Buffer, /*z*/ DataType.ByteString>;
}

// This Simple DataType is a Double that defines an interval of time in milliseconds (fractions can be used to define sub-millisecond values).
// Negative values are generally invalid but may have special meanings where the Duration is used.
export const OneDayDuration = 1000 * 60 * 60 * 24;
export const TwoWeeksDuration = OneDayDuration * 2 * 7;

/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server’s
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
class UACertificateExpirationAlarmImpl extends UASystemOffNormalAlarmImpl implements UACertificateExpirationAlarmEx {
    private timer: NodeJS.Timeout | null = null;

    public static instantiate(
        namespace: INamespace,
        alarmType: "CertificateExpirationAlarmType",
        options: InstantiateOffNormalAlarmOptions
        // data?: Record<string, VariantOptions>
    ): UACertificateExpirationAlarmImpl {
        const alarm = UASystemOffNormalAlarmImpl.instantiate(
            namespace,
            alarmType || "CertificateExpirationAlarmType",
            options
            // data
        ) as UACertificateExpirationAlarmImpl;
        promoteToCertificateExpirationAlarm(alarm);
        return alarm;
    }

    public getExpirationDate(): DateTime | null {
        return this.expirationDate.readValue().value.value;
    }

    public updateAlarmState2(isActive: boolean, severity: number, message: string) {
        isActive ? this.activateAlarm() : this.deactivateAlarm();

        this.raiseNewCondition({
            message,
            quality: StatusCodes.Good,
            retain: isActive ? true : false,
            severity
        });
    }

    public update() {
        this._updateAlarm();
    }

    private _updateAlarm() {
        const expirationDate = this.getExpirationDate();

        const now = new Date();

        const expirationLimit = this.getExpirationLimit();

        const checkDate = new Date(now.getTime() + +expirationLimit);

        const certificate = this.getCertificate();

        if (!expirationDate || (expirationDate === minOPCUADate && !certificate)) {
            if (!this.currentBranch() || this.currentBranch().getActiveState()) {
                this.updateAlarmState2(true, 255, "certificate is missing");
            }
            return;
        }

        const thumbprint = ellipsis(makeSHA1Thumbprint(this.getCertificate() || Buffer.alloc(0)).toString("hex"), 10);
        const info = `| end date: ${d(expirationDate)} | expirationLimit=${expirationLimit}|`;
        //

        if (expirationDate.getTime() <= checkDate.getTime()) {
            // also raise the event
            if (expirationDate.getTime() <= now.getTime()) {
                this.updateAlarmState2(true, 250, `certificate ${thumbprint} has expired ${info}`);
            } else {
                //             check--------------------+
                //       expiry---------------+         |
                //       today-----+          |         |
                //                 v          v         v
                // ----------------+----------+---------+----------+
                const t1 = checkDate.getTime() - now.getTime();
                const t2 = checkDate.getTime() - expirationDate.getTime();
                const severity = t1 === 0 ? 255 : Math.floor((t2 / t1) * 100) + 100;
                this.updateAlarmState2(true, severity, `certificate ${thumbprint} is about to expire ${info}`);
            }
        } else {
            this.updateAlarmState2(false, 0, `certificate ${thumbprint} is OK! ${info}`);
        }
    }

    public setExpirationDate(expirationDate: Date): void {
        this.expirationDate.setValueFromSource({
            dataType: DataType.DateTime,
            value: expirationDate
        });
        this._updateAlarm();
    }

    public getExpirationLimit(): number {
        // This shall be a positive number. If the property is not provided, a default of 2 weeks shall be used.
        if (!this.expirationLimit) {
            return TwoWeeksDuration;
        }
        const dataValue = this.expirationLimit!.readValue();
        if ((dataValue as any).dataType === DataType.Null) {
            return TwoWeeksDuration;
        }
        return (this.expirationLimit?.readValue().value.value as number) || 0;
    }

    public setExpirationLimit(value: number): void {
        this.expirationLimit?.setValueFromSource({
            dataType: DataType.Double,
            value
        });
        this._updateAlarm();
    }

    public getCertificate(): Certificate | null {
        return (this.certificate.readValue().value.value as Certificate | null) || null;
    }

    private _extractAndSetExpiryDate(certificate: Certificate | null): void {
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
    }

    public setCertificate(certificate: Certificate | null): void {
        this.certificate.setValueFromSource({
            dataType: DataType.ByteString,
            value: certificate
        });
        this._extractAndSetExpiryDate(certificate);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    _post_initialize() {
        if (this.expirationLimit) {
            this.expirationLimit.accessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.userAccessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.on("value_changed", (dataValue) => {
                // make sure we re-evaluate the certificate
                const certificate = this.getCertificate();
                this.setCertificate(certificate);
            });
        }
        const certificate = this.getCertificate();
        this._extractAndSetExpiryDate(certificate);

        this.addressSpace.registerShutdownTask(() => {
            this.stopTimer();
        });
        this.timer = setInterval(() => this.update(), OneDayDuration / 48);
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
registerNodePromoter(ObjectTypeIds.CertificateExpirationAlarmType, promoteToCertificateExpirationAlarm, true);
