/**
 * Store `value` under `key` as an ordinary own property, whatever `key` is.
 *
 * `obj[key] = value` does not do that for every key: when `key` is "__proto__" the assignment
 * reaches the accessor inherited from Object.prototype and replaces the object's prototype
 * instead of creating a property. Use this wherever the key is a name taken from outside the
 * program - a field of a decoded structure, a browse name, an XML tag or attribute, a JSON key.
 *
 * It covers the write only. A plain object READ with such a key still finds inherited members
 * (`table["constructor"]` is a function): give a lookup table no prototype with
 * `Object.create(null)`, or use a Map.
 */
export function setOwnProperty<T>(obj: Record<string, T>, key: string, value: T): void {
    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
}
