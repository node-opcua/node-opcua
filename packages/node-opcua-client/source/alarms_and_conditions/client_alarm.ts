import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCode } from "node-opcua-status-code";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant } from "node-opcua-variant";
import { ClientSession } from "../client_session";

const warningLog = make_warningLog(__filename);

export interface TVariant<T> extends Variant {
    value: T;
}
export interface TTwoStateStatus extends TVariant<string> {
    id: TVariant<boolean>;
}
export interface EventStuff {
    conditionId: TVariant<NodeId>;
    eventType: TVariant<NodeId>;
    eventId: TVariant<Buffer>;
    retain: TVariant<boolean>;
    activeState: TTwoStateStatus;
    ackedState: TTwoStateStatus;
    confirmedState: TTwoStateStatus;
    conditionName?: TVariant<string>;
}

export interface ClientAlarm {
    conditionId: NodeId;
    eventType: NodeId;
    fields: EventStuff;
    on(eventName: "changed", eventHandler: () => void): this;
    acknowledge(session: ClientSession, comment: string): Promise<StatusCode>;
    getField(fieldName: string): Variant | null;
}

/**
 * describes a OPCUA Alarm as seen in the client side
 */
export class ClientAlarm extends EventEmitter {
    public conditionId: NodeId;
    public eventType: NodeId;
    public eventId: Buffer;
    public fields: EventStuff;

    public constructor(eventFields: EventStuff) {
        super();
        this.conditionId = resolveNodeId(eventFields.conditionId.value);
        this.eventType = resolveNodeId(eventFields.eventType.value);
        this.eventId = eventFields.eventId.value;
        this.fields = eventFields;
        this.update(eventFields);
    }
    public async acknowledge(session: ClientSession, comment: string): Promise<StatusCode> {
        return await session.acknowledgeCondition(this.conditionId, this.eventId, comment);
    }
    public async confirm(session: ClientSession, comment: string): Promise<StatusCode> {
        return await session.confirmCondition(this.conditionId, this.eventId, comment);
    }
    public update(eventFields: EventStuff): void {
        assert(this.conditionId.toString() === resolveNodeId(eventFields.conditionId.value).toString());
        assert(this.eventType.toString() === resolveNodeId(eventFields.eventType.value).toString());
        this.eventId = eventFields.eventId.value;
        this.fields = eventFields;
    }
    public getRetain(): boolean {
        return this.fields.retain.value;
    }
    public toString(): string {
        return (
            this.constructor.name +
            ": " +
            this.conditionId.toString() +
            " " +
            this.eventType.toString() +
            " " +
            Object.entries(this.fields)
                .filter(([key, value]) => value.dataType !== DataType.Null)
                .map(([key, value]) => key.padEnd(30) + "=" + value.toString())
                .join("\n") +
            "\n\n"
        );
    }

    public getField(fieldName: string): Variant | null {
        return (this.fields as any)[fieldName] || null;
    }
}

/**
 * @private
 */
export function fieldsToJson(fields: string[], eventFields: Variant[], flat?: boolean): EventStuff {

    function setProperty(_data: Record<string, unknown>, fieldName: string, value: Variant) {
        let name: string;
        if (!fieldName || value === null) {
            return;
        }
        if (!flat) {
            const f = fieldName.split(".");
            if (f.length === 1) {
                fieldName = lowerFirstLetter(fieldName);
                _data[fieldName] = value;
            } else {
                for (let i = 0; i < f.length - 1; i++) {
                    name = lowerFirstLetter(f[i]);
                    _data[name] = _data[name] || {};
                    _data = _data[name] as Record<string, unknown>;
                }
                name = lowerFirstLetter(f[f.length - 1]);
                _data[name] = value;
            }
        } else {
            const name = fieldName.split(".").map(lowerFirstLetter).join(".");
            _data[name] = value;
        }
    }
    if (fields.length > eventFields.length) {
        warningLog("warning fields.length !==  eventFields.length", fields.length, eventFields.length);
    }
    const data: any = {};
    for (let index = 0; index < fields.length; index++) {
        const variant = eventFields[index];
        setProperty(data, fields[index], variant);
    }

    return data;
}
