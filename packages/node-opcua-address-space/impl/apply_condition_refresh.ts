import type { UAObject, UAVariable } from "../api/index.js";
import type { UAObjectImpl } from "./ua_object_impl.js";

export type ConditionRefreshCache = Map<string, UAObjectImpl>;

/**
 * The condition subsystem is recognised structurally rather than with
 * `instanceof UAConditionImpl`.
 *
 * Importing that class as a value from here closed an eight-file import cycle:
 * ua_object_impl and ua_variable_impl both import this module, this module imported
 * UAConditionImpl, and UAConditionImpl reaches back to both of them through
 * `extends UABaseEventImplBase` and `extends UAObjectImpl`.
 *
 * Under CommonJS that is survivable, because the second module to load sees a partially
 * populated exports object and nothing touches the missing half until a function runs.
 * Under ESM a class in a cycle is in the temporal dead zone while the cycle is being
 * evaluated, so `class UABaseEventImplBase extends UAObjectImpl` would throw a
 * ReferenceError as the graph loads.
 *
 * `_resend_conditionEvents` is declared only on UAConditionImpl, so this test selects
 * exactly what the `instanceof` selected, subclasses included. It is also the idiom this
 * same function already uses for `notifier._conditionRefresh` below.
 */
interface ConditionLike {
    _resend_conditionEvents(): 0 | 1;
}

function isCondition(node: object): node is ConditionLike {
    return typeof (node as Partial<ConditionLike>)._resend_conditionEvents === "function";
}

export function apply_condition_refresh(this: UAObject | UAVariable, cache?: ConditionRefreshCache): void {
    // visit all notifiers recursively
    cache = cache || new Map();
    const notifiers = this.getNotifiers();
    const eventSources = this.getEventSources();

    const conditions = this.findReferencesAsObject("HasCondition", true);
    for (const condition of conditions) {
        if (isCondition(condition)) {
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
