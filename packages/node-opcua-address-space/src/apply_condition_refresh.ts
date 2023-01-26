import { BaseNode, UAObject } from "node-opcua-address-space-base";
import { UAConditionImpl } from "./alarms_and_conditions/ua_condition_impl";
import { BaseNodeImpl } from "./base_node_impl";
import { UAObjectImpl } from "./ua_object_impl";

export type ConditionRefreshCache = { [key in string]: UAObject };
export function apply_condition_refresh(this: BaseNodeImpl, cache?: ConditionRefreshCache): void {
    // visit all notifiers recursively
    cache = cache || {};
    const notifiers = this.getNotifiers();
    const eventSources = this.getEventSources();

    const conditions = this.findReferencesAsObject("HasCondition", true);
    for (const condition of conditions) {
        if (condition instanceof UAConditionImpl) {
            condition._resend_conditionEvents();
        }
    }
    const arr = ([] as UAObjectImpl[]).concat(notifiers as UAObjectImpl[], eventSources as UAObjectImpl[]);

    for (const notifier of arr) {
        const key = notifier.nodeId.toString();
        if (!cache[key]) {
            cache[key] = notifier;
            if (notifier._conditionRefresh) {
                notifier._conditionRefresh(cache);
            }
        }
    }
}
