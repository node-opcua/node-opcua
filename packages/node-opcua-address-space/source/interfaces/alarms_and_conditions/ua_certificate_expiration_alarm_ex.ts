import { DateTime } from "node-opcua-basic-types";
import { Certificate } from "node-opcua-crypto";
import { UACertificateExpirationAlarm_Base } from "node-opcua-nodeset-ua";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { UAAcknowledgeableConditionEx, UAAcknowledgeableConditionHelper } from "./ua_acknowledgeable_condition_ex";

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
}
