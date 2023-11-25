import { NodeId } from "node-opcua-nodeid";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant } from "node-opcua-variant";

import { make_warningLog } from "node-opcua-debug";
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
