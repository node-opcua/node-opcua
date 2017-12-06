"use strict"
/**
 * @method getObjectClassName
 * @param obj
 * @return {string}
 */
function getObjectClassName(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}
exports.getObjectClassName =getObjectClassName;