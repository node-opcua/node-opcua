import type { DateTime } from "node-opcua-basic-types";
import type { Certificate } from "node-opcua-crypto/web";
import type { UACertificateExpirationAlarm_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import type { UAAcknowledgeableConditionEx } from "./ua_acknowledgeable_condition_ex";

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
        >,
        UAAcknowledgeableConditionEx {
    activeState: UATwoStateVariableEx;
    suppressedState?: UATwoStateVariableEx;

    getExpirationDate(): DateTime;
    setExpirationDate(value: Date): void;
    getExpirationLimit(): number;
    setExpirationLimit(value: number): void;
    setCertificate(certificate: Certificate | null): void;
    getCertificate(): Certificate | null;

    /**
     * update the    status of the alarm
     */
    update(): void;
}
