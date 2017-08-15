"use strict";
/**
 * @module opcua.miscellaneous

 *
 */
/**
 * @class Enum
 * @constructor
 * Represents an Item of an Enum.
 * @param {String} key  The Enum key.
 * @param {Number} value The Enum value.
 */
var EnumItem = function (key, value) {
    this.key = key;
    this.value = value;
};

/**
 * Checks if the EnumItem is the same as the passing object.
 * @method is
 * @param  {EnumItem || String || Number} item The object to check with.
 * @return {Boolean}                          The check result.
 */
EnumItem.prototype.is = function (item) {
    if (item instanceof EnumItem) {
        return this.value === item.value;
    } else if (typeof item === 'string') {
        return this.key === item;
    } else {
        return this.value === item;
    }
};

/**
 * Checks if the flagged EnumItem has the passing object.
 * @method has
 * @param  {EnumItem || String || Number} value The object to check with.
 * @return {Boolean}                            The check result.
 */
EnumItem.prototype.has = function (value) {
    if (value instanceof EnumItem) {
        return (value.value & this.value) !== 0;
    } else if (typeof value === 'string') {
        return this.key.indexOf(value) >= 0;
    } else {
        return (value & this.value) !== 0;
    }
};

/**
 * Returns String representation of this EnumItem.
 * @method toString
 * @return {String} String representation of this EnumItem.
 */

EnumItem.prototype.toString = function toString() {
    return this.key;
};

/**
 * Returns JSON object representation of this EnumItem.
 * @method toJSON
 * @return {String} JSON object representation of this EnumItem.
 */

EnumItem.prototype.toJSON = function toJSON() {
    return this.key;
};

/**
 * Returns the value to compare with.
 * @method valueOf
 * @return {String} The value to compare with.
 */

EnumItem.prototype.valueOf = function valueOf() {
    return this.value;
};

// check if enum is flaggable
var check_is_flaggable = function (enums) {
    for (var i in enums) {
        var e = enums[i];
        if (!(e.value !== 0 && !(e.value & e.value - 1))) {
            return false;
        }
    }
    return true;
};
/**
 * @class Enum
 * @constructor
 * Represents an Enum with enum items.
 * @param {Array || Object}  map     This are the enum items.
 */
var Enum = function (map) {
    var self = this;
    self.enums = [];
    var mm = null;

    var is_flaggable = null;
    if (Array.isArray(map)) {
        // create map as flaggable enum
        mm = {};
        for (var i = 0; i < map.length; i++) {
            mm[map[i]] = 1 << i;
        }
        is_flaggable = true;
    } else {
        mm = map;
    }

    for (var key in mm) {
        var val = mm[key];
        if (undefined === val) { continue; }
        var kv = new EnumItem(key, val);
        self[key] = kv;
        self[val] = kv;
        self.enums.push(kv);
    }

    if (!is_flaggable) {
        is_flaggable = check_is_flaggable(self.enums);
    }
    this._is_flaggable = is_flaggable;
};

/**
 * Returns the appropriate EnumItem.
 * @method get
 * @param  {EnumItem || String || Number} key The object to get with.
 * @return {EnumItem}                         The get result.
 */
Enum.prototype.get = function (key) {

    if (key === null || key === undefined) {
        return null;
    }
    var prop = this[key];
    if (prop) {
        return prop;
    } else if (this._is_flaggable) {
        if (typeof key === "string") {
            return this._get_by_str(key);
        } else if (typeof key === "number") {
            return this._get_by_num(key);
        }
    }
};

Enum.prototype._get_by_str = function (key) {

    var parts = key.split(' | ');

    var val = 0;
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        var item = this[part];
        if (undefined === item) {
            return undefined;
        }
        val |= item.value;
    }
    var kv = new EnumItem(key, val);

    // add in cache for later
    var prop = this[val];
    if (prop === undefined) {
        this[val] = kv;
    }
    prop = this[key];
    if (prop === undefined) {
        this[key] = kv;
    }
    return kv;
};

Enum.prototype._get_by_num = function (key) {

    if (key === 0) { return undefined; }

    var name;
    var c = 1, item;
    for (var i = 0; c < key; i++) {
        if ((c & key) === c) {
            item = this[c];
            if (undefined === item) {
                return undefined;
            }
            if (name) {
                name = name + " | " + item.key;
            } else {
                name = item.key;
            }
        }
        c *= 2;
    }
    var kv = new EnumItem(name, key);
    // add in cache for later
    this[name] = kv;
    this[key] = kv;

    return kv;
};

module.exports = Enum;
