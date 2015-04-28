"use strict";

/**
 * Represents an Item of an Enum.
 * @param {String} key  The Enum key.
 * @param {Number} value The Enum value.
 */
var EnumItem = function(key, value) {
    this.key = key;
    this.value = value;
}

/**
 * Checks if the EnumItem is the same as the passing object.
 * @param  {EnumItem || String || Number} item The object to check with.
 * @return {Boolean}                          The check result.
 */
EnumItem.prototype.is = function(item) {
    if(item instanceof EnumItem) {
        return this.value === item.value;
    } else if (typeof item === 'string') {
        return this.key === item;
    } else {
        return this.value === item;
    }
}

/**
 * Checks if the flagged EnumItem has the passing object.
 * @param  {EnumItem || String || Number} value The object to check with.
 * @return {Boolean}                            The check result.
 */
EnumItem.prototype.has = function(value) {
    if(value instanceof EnumItem) {
        return (value.value&this.value) !== 0;
    } else if(typeof value === 'string') {
        return this.key.indexOf(value)>=0;
    } else {
        return (value&this.value) !== 0;
    }
}

/**
 * Returns String representation of this EnumItem.
 * @return {String} String representation of this EnumItem.
 */

EnumItem.prototype.toString = function toString() {
    return this.key;
};

/**
 * Returns JSON object representation of this EnumItem.
 * @return {String} JSON object representation of this EnumItem.
 */

EnumItem.prototype.toJSON = function toJSON() {
    return this.key;
};

/**
 * Returns the value to compare with.
 * @return {String} The value to compare with.
 */

EnumItem.prototype.valueOf = function valueOf() {
    return this.value;
};

/**
 * Represents an Enum with enum items.
 * @param {Array || Object}  map     This are the enum items.
 */
var Enum = function(map){
    var self = this;
    self.enums = [];
    var mm = null;
    if(Array.isArray(map)) {
    	// create map as flaggable enum
        mm = {};
        for(var i in map) {
            mm[map[i]] = 1<<i;
        }
    } else {
        mm = map;
    }
    for(var key in mm) {
        if(!mm.hasOwnProperty(key)) continue;
        var val = mm[key];
        var kv = new EnumItem(key,val);
        self[key] = kv;
        self[val] = kv;
        self.enums.push(kv);
    }

    // check if enum is flaggable
    var is_flaggable = function () {
	    for(var i in self.enums) {
	    	var e = self.enums[i];
	        if (!(e.value !== 0 && !(e.value & e.value - 1))) {
	          return false;
	        }
	    }
	    return true;
    }

    this._is_flaggable = is_flaggable();
}

/**
 * Returns the appropriate EnumItem.
 * @param  {EnumItem || String || Number} key The object to get with.
 * @return {EnumItem}                         The get result.
 */
Enum.prototype.get = function(key){
    if(key===null||key===undefined) {
        return;
    }
    if(key instanceof EnumItem) {
        key = key.key;
    }

    if(this.hasOwnProperty(key)) {
        return this[key];
    } else if(this._is_flaggable) {
	    if(typeof key === "string") {
	        return this._get_by_str(key);
	    } else if(typeof key === "number") {
	        return this._get_by_num(key);
	    }
    }
    return;
}

Enum.prototype._get_by_str = function(key) {
    if(key.indexOf(' | ')>-1) {
        var val = 0;
        var keys = key.split(' | ');
        for(var i in keys) {
        	if(!this.hasOwnProperty(keys[i])) {
        		return;
        	}
            val = val | this[keys[i]].value;
        }
        var kv = new EnumItem(key,val);
        if(this.hasOwnProperty(val)) {
        	this[kv.key] = kv;
        } else {
	        // cache val->kv item through _get_by_num
	        var kv2 = this._get_by_num(val);
	        if( kv2.key !== kv.key ) {
	            // keys are not in the same order, cache it
	            this[kv.key] = kv;
	        }

        }
        return kv;
    }
}

Enum.prototype._get_by_num = function(key) {
	if(key===0) return;
    var names = [];
    for(var i=0; key>>i !== 0; i++) {
    	var val = 1<<i;
        if(key&val){
            if( this.hasOwnProperty(val) ) {
                names.push(this[val].key);
            } else {
                return;
            }
        }
    }
    var name = names.join(' | ');
    var kv = new EnumItem(name,key);
    this[name] = kv;
    this[key] = kv;
    return kv;
}

module.exports = Enum;
