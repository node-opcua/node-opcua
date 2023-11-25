import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCode } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { IBasicSessionAsync} from "node-opcua-pseudo-session";
import { EventStuff} from "./event_stuff";
import { acknowledgeCondition, confirmCondition } from "./call_method_condition";



export interface ClientAlarm {
    conditionId: NodeId;
    eventType: NodeId;
    fields: EventStuff;
    on(eventName: "changed", eventHandler: () => void): this;
    acknowledge(session: IBasicSessionAsync, comment: string): Promise<StatusCode>;
    confirm(session: IBasicSessionAsync, comment: string): Promise<StatusCode>;
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
    public async acknowledge(session: IBasicSessionAsync, comment: string): Promise<StatusCode> {
        return await acknowledgeCondition(session, this.conditionId, this.eventId, comment);
    }
    public async confirm(session: IBasicSessionAsync, comment: string): Promise<StatusCode> {
        return await confirmCondition(session, this.conditionId, this.eventId, comment);
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
