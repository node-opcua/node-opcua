/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { INamespace, UAObject, UAProperty, UAVariable } from "node-opcua-address-space-base";
import { type DateTime, getMinOPCUADate, isMinDate, StatusCodes } from "node-opcua-basic-types";
import { ObjectTypeIds } from "node-opcua-constants";
import { type Certificate, exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { makeAccessLevelExFlag } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import type { InstantiateOffNormalAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import type { UACertificateExpirationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_certificate_expiration_alarm_ex";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { UASystemOffNormalAlarmImpl } from "./ua_system_off_normal_alarm_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

const ellipsis = (arg0: string, arg1 = 4) => {
    arg1 = Math.max(arg1, 4);
    return arg0.length <= arg1 ? arg0 : `${arg0.slice(0, arg1 / 2)}...${arg0.slice(arg0.length - arg1 / 2)}`;
};
const d = (d: Date) => {
    return d.toISOString();
};
export function instantiateCertificateExpirationAlarm(
    namespace: INamespace,
    alarmType: "CertificateExpirationAlarmType",
    options: InstantiateOffNormalAlarmOptions
): UACertificateExpirationAlarmEx {
    return UACertificateExpirationAlarmImplBase.instantiate(namespace, alarmType, options);
}

// This Simple DataType is a Double that defines an interval of time in milliseconds (fractions can be used to define sub-millisecond values).
// Negative values are generally invalid but may have special meanings where the Duration is used.
export const OneDayDuration = 1000 * 60 * 60 * 24;
export const TwoWeeksDuration = OneDayDuration * 2 * 7;

/**
 * This UACertificateExpirationAlarm (SystemOffNormalAlarmType) is raised by the Server when the Server's
 * Certificate is within the ExpirationLimit
 * of expiration. This alarm automatically returns to normal when the certificate is updated.
 */
class UACertificateExpirationAlarmImplBase extends UASystemOffNormalAlarmImpl {
    declare expirationDate: UAProperty<Date, DataType.DateTime>;
    declare expirationLimit: UAProperty<number, DataType.Double> | undefined;
    declare certificateType: UAProperty<NodeId, DataType.NodeId>;
    declare certificate: UAProperty<Buffer, DataType.ByteString>;

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
        return (this.getChildByName("ExpirationDate") as UAVariable)?.readValue().value.value;
    }

    public updateAlarmState2(isActive: boolean, severity: number, message: string) {
        isActive ? this.activateAlarm() : this.deactivateAlarm();

        this.raiseNewCondition({
            message,
            quality: StatusCodes.Good,
            retain: !!isActive,
            severity
        });
    }

    public update() {
        this._updateAlarm();
    }

    private _updateAlarm() {
        if (!this.enabledState) {
            warningLog(`expiry alarm ${this.nodeId.toString()}  has no enabledState property`);
            return;
        }

        const expirationDate = this.getExpirationDate();

        const now = new Date();

        const expirationLimit = this.getExpirationLimit();

        const checkDate = new Date(now.getTime() + +expirationLimit);

        const certificate = this.getCertificate();

        if (!expirationDate || (isMinDate(expirationDate) && !certificate)) {
            if (this.currentBranch()?.getActiveState()) {
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
        const dataValue = this.expirationLimit.readValue();
        if ((dataValue.value.dataType as DataType) === DataType.Null) {
            return TwoWeeksDuration;
        }
        return (dataValue.value.value as number) || 0;
    }

    public setExpirationLimit(value: number): void {
        this.expirationLimit?.setValueFromSource({
            dataType: DataType.Double,
            value
        });
        this._updateAlarm();
    }

    public getCertificate(): Certificate | null {
        return ((this.getChildByName("Certificate") as UAVariable)?.readValue().value.value as Certificate) || null;
    }

    private _extractAndSetExpiryDate(certificate: Certificate | null): void {
        if (certificate && certificate.length > 0) {
            const info = exploreCertificate(certificate);
            if (info.tbsCertificate.validity.notAfter) {
                this.setExpirationDate(info.tbsCertificate.validity.notAfter);
            } else {
                this.setExpirationDate(getMinOPCUADate());
            }
        } else {
            this.setExpirationDate(getMinOPCUADate());
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
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private _startTimer() {
        this.timer = setTimeout(() => {
            if (!this.timer) return;
            this.update();
            this._startTimer();
        }, OneDayDuration / 48);
        // don't keep the process alive just for this monitoring timer
        if (this.timer && typeof this.timer.unref === "function") {
            this.timer.unref();
        }
    }

    _post_initialize() {
        // ensure _branch0 is created (base UAConditionImpl)
        if (!this.currentBranch()) {
            this.post_initialize();
        }
        if (this.expirationLimit) {
            this.expirationLimit.accessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.userAccessLevel = makeAccessLevelExFlag("CurrentRead | CurrentWrite");
            this.expirationLimit.on("value_changed", (_dataValue) => {
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
        this._startTimer();
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

export type UACertificateExpirationAlarmImpl = UACertificateExpirationAlarmImplBase & UACertificateExpirationAlarmEx;
export const UACertificateExpirationAlarmImpl: new () => UACertificateExpirationAlarmImpl =
    UACertificateExpirationAlarmImplBase as any;
