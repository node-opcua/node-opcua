import type { UAObject, UAVariable } from "../source";
import { UAConditionImpl } from "./alarms_and_conditions/ua_condition_impl";
import type { UAObjectImpl } from "./ua_object_impl";

export type ConditionRefreshCache = Map<string, UAObjectImpl>;
export function apply_condition_refresh(this: UAObject | UAVariable, cache?: ConditionRefreshCache): void {
    // visit all notifiers recursively
    cache = cache || new Map();
    const notifiers = this.getNotifiers();
    const eventSources = this.getEventSources();
    
    const conditions = this.findReferencesAsObject("HasCondition", true);
    for (const condition of conditions) {
        if (condition instanceof UAConditionImpl) {
            condition._resend_conditionEvents();
        }
    }
    const arr = [...notifiers, ...eventSources] as UAObjectImpl[];

    for (const notifier of arr) {
        const key = notifier.nodeId.toString();
        if (!cache.has(key)) {
            cache.set(key, notifier);
            if (notifier._conditionRefresh) {
                notifier._conditionRefresh(cache);
            }
        }
    }
}
