import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { EventStuff } from "./event_stuff";
import { ClientAlarm } from "./client_alarm";

export interface ClientAlarmList {
    on(eventName: "alarmChanged", handler: (alarm: ClientAlarm) => void): this;
    on(eventName: "alarmDeleted", handler: (alarm: ClientAlarm) => void): this;
    on(eventName: "newAlarm", handler: (alarm: ClientAlarm) => void): this;

    emit(eventName: "alarmChanged", alarm: ClientAlarm): boolean;
    emit(eventName: "newAlarm", alarm: ClientAlarm): boolean;
    emit(eventName: "alarmDeleted", alarm: ClientAlarm): boolean;
}
// maintain a set of alarm list for a client
export class ClientAlarmList extends EventEmitter implements Iterable<ClientAlarm> {
    private _map: Map<string,ClientAlarm> = new Map();
    public constructor() {
        super();
    }

    public [Symbol.iterator](): Iterator<ClientAlarm> {
        let pointer = 0;
        const components = [...this._map.values()];
        return {
            next(): IteratorResult<ClientAlarm> {
                if (pointer >= components.length) {
                    return {
                        done: true,
                        value: components[pointer++]
                    };
                } else {
                    return {
                        done: false,
                        value: components[pointer++]
                    };
                }
            }
        };
    }

    public alarms(): ClientAlarm[] {
        return [...this._map.values()];
    }

    public update(eventField: EventStuff): void {
        // Spec says:
        // Clients shall check for multiple Event Notifications for a ConditionBranch to avoid
        // overwriting a new state delivered together with an older state from the Refresh
        // process.

        const { conditionId, eventType } = eventField;
        assert(conditionId, "must have a valid conditionId ( verify that event is a acknowledgeable type");
        const alarm = this.findAlarm(conditionId.value, eventType.value);

        if (!alarm) {
            const key = this.makeKey(conditionId.value, eventType.value);
            const newAlarm = new ClientAlarm(eventField);
            this._map.set(key,newAlarm);
            this.emit("newAlarm", newAlarm);
            this.emit("alarmChanged", newAlarm);
        } else {
            alarm.update(eventField);
            this.emit("alarmChanged", alarm);
        }
    }
    public removeAlarm(eventField: EventStuff): void {
        const { conditionId, eventType } = eventField;
        const alarm = this.findAlarm(conditionId.value, eventType.value);
        if (alarm) {
            alarm.update(eventField);
            this._removeAlarm(alarm);
        }
    }

    public get length(): number {
        return this._map.size;
    }
    public purgeUnusedAlarms(): void {
        const alarms = this.alarms();
        for (const alarm of alarms) {
            if (!alarm.getRetain()) {
                this._removeAlarm(alarm);
            }
        }
    }

    private _removeAlarm(alarm: ClientAlarm) {
        this.emit("alarmDeleted", alarm);
        this.deleteAlarm(alarm.conditionId, alarm.eventType);
    }

    private makeKey(conditionId: NodeId, eventType: NodeId) {
        return conditionId.toString() + "|" + eventType.toString();
    }
    private findAlarm(conditionId: NodeId, eventType: NodeId): ClientAlarm | null {
        const key = this.makeKey(conditionId, eventType);
        const _c = this._map.get(key);
        return _c || null;
    }
    private deleteAlarm(conditionId: NodeId, eventType: NodeId): boolean {
        const key = this.makeKey(conditionId, eventType);
        const _c = this._map.has(key);
        if (_c) {
            this._map.delete(key);
            return true;
        }
        return false;
    }
}
