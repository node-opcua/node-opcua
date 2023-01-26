/**
 * @module node-opcua-factory
 */
const _FIRST_INTERNAL_ID = 0xfffe0000;

let _nextAvailableId = _FIRST_INTERNAL_ID;

export function generate_new_id(): number {
    _nextAvailableId += 1;
    return _nextAvailableId;
}

export function next_available_id(): number {
    return -1;
}
export function is_internal_id(value: number): boolean {
    return value >= _FIRST_INTERNAL_ID;
}
