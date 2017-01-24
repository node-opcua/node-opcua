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
class EnumItem {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }

  /**
   * Checks if the EnumItem is the same as the passing object.
   * @method is
   * @param  {EnumItem || String || Number} item The object to check with.
   * @return {Boolean}                          The check result.
   */
  is(item) {
    if (item instanceof EnumItem) {
      return this.value === item.value;
    } else if (typeof item === 'string') {
      return this.key === item;
    } 
    return this.value === item;
  }

  /**
   * Checks if the flagged EnumItem has the passing object.
   * @method has
   * @param  {EnumItem || String || Number} value The object to check with.
   * @return {Boolean}                            The check result.
   */
  has(value) {
    if (value instanceof EnumItem) {
      return (value.value & this.value) !== 0;
    } else if (typeof value === 'string') {
      return this.key.indexOf(value) >= 0;
    } 
    return (value & this.value) !== 0;
  }

  /**
   * Returns String representation of this EnumItem.
   * @method toString
   * @return {String} String representation of this EnumItem.
   */

  toString() {
    return this.key;
  }

  /**
   * Returns JSON object representation of this EnumItem.
   * @method toJSON
   * @return {String} JSON object representation of this EnumItem.
   */

  toJSON() {
    return this.key;
  }

  /**
   * Returns the value to compare with.
   * @method valueOf
   * @return {String} The value to compare with.
   */

  valueOf() {
    return this.value;
  }
}

// check if enum is flaggable
const check_is_flaggable = (enums) => {
  for (const i in enums) {
    const e = enums[i];
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
class Enum {
  constructor(map) {
    const self = this;
    self.enums = [];
    let mm = null;

    let is_flaggable = null;
    if (Array.isArray(map)) {
          // create map as flaggable enum
      mm = {};
      for (let i = 0; i < map.length; i++) {
        mm[map[i]] = 1 << i;
      }
      is_flaggable = true;
    } else {
      mm = map;
    }

    for (const key in mm) {
      const val = mm[key];
      if (undefined === val) { continue; }
      const kv = new EnumItem(key, val);
      self[key] = kv;
      self[val] = kv;
      self.enums.push(kv);
    }

    if (!is_flaggable) {
      is_flaggable = check_is_flaggable(self.enums);
    }
    this._is_flaggable = is_flaggable;
  }

  /**
   * Returns the appropriate EnumItem.
   * @method get
   * @param  {EnumItem || String || Number} key The object to get with.
   * @return {EnumItem}                         The get result.
   */
  get(key) {
    if (key === null || key === undefined) {
      return null;
    }
    const prop = this[key];
    if (prop) {
      return prop;
    } else if (this._is_flaggable) {
      if (typeof key === "string") {
        return this._get_by_str(key);
      } else if (typeof key === "number") {
        return this._get_by_num(key);
      }
    }
  }

  _get_by_str(key) {
    const parts = key.split(' | ');

    let val = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const item = this[part];
      if (undefined === item) {
        return undefined;
      }
      val |= item.value;
    }
    const kv = new EnumItem(key, val);

      // add in cache for later
    let prop = this[val];
    if (prop === undefined) {
      this[val] = kv;
    }
    prop = this[key];
    if (prop === undefined) {
      this[key] = kv;
    }
    return kv;
  }

  _get_by_num(key) {
    if (key === 0) { return undefined; }

    let name;
    let c = 1;
    let item;
    for (let i = 0; c < key; i++) {
      if ((c & key) === c) {
        item = this[c];
        if (undefined === item) {
          return undefined;
        }
        if (name) {
          name = `${name} | ${item.key}`;
        } else {
          name = item.key;
        }
      }
      c *= 2;
    }
    const kv = new EnumItem(name, key);
      // add in cache for later
    this[name] = kv;
    this[key] = kv;

    return kv;
  }
}

export default Enum;
