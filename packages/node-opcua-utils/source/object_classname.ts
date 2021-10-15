/**
 * @module node-opcua-utils
 */
/**
 * @method getObjectClassName
 * @param obj
 * @return {string}
 */
export function getObjectClassName(obj: unknown): string {
    return Object.prototype.toString.call(obj).slice(8, -1);
}
