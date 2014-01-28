/**
 *
 * @param obj
 * @returns {string}
 */
function getObjectClassName(obj){
    return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * invoke a constructor without new
 * @param constructor
 * @returns {factory}
 */
function create(constructor) {
    var factory = constructor.bind.apply(constructor, arguments);
    return new factory();
}

exports.getObjectClassName = getObjectClassName;
exports.create = create;
