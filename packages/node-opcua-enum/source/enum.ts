/**
 * @module node-opcua-enum
 *
 */
// tslint:disable:no-bitwise
// tslint:disable:max-classes-per-file

/**
 * Represents an Item of an Enum.
 *
 * @class Enum
 */
export class EnumItem {
    public key: string;
    public value: number;

    /**
     *
     * @param key the enum key
     * @param value the enum value
     */
    public constructor(key: string, value: number) {
        this.key = key;
        this.value = value;
    }

    /**
     * Checks if the EnumItem is the same as the passing object.
     * @method is
     * @param  {EnumItem | String | Number} item The object to check with.
     * @return {Boolean}                          The check result.
     */
    public is(item: EnumItem | string | number): boolean {
        if (item instanceof EnumItem) {
            return this.value === item.value;
        } else if (typeof item === "string") {
            return this.key === item;
        } else {
            return this.value === item;
        }
    }

    /**
     * Checks if the flagged EnumItem has the passing object.
     * @method has
     * @param  {EnumItem | String |Number} value The object to check with.
     * @return {Boolean}                            The check result.
     */
    public has(value: string | number | EnumItem): boolean {
        if (value instanceof EnumItem) {
            return (value.value & this.value) !== 0;
        } else if (typeof value === "string") {
            return this.key.indexOf(value) >= 0;
        } else {
            return (value & this.value) !== 0;
        }
    }

    /**
     * Returns String representation of this EnumItem.
     * @method toString
     * @return {String} String representation of this EnumItem.
     */
    public toString(): string {
        return this.key;
    }

    /**
     * Returns JSON object representation of this EnumItem.
     * @method toJSON
     * @return {String} JSON object representation of this EnumItem.
     */

    public toJSON(): any {
        return this.key;
    }

    /**
     * Returns the value to compare with.
     * @method valueOf
     * @return {String} The value to compare with.
     */

    public valueOf(): number {
        return this.value;
    }
}

function powerOfTwo(n: number): boolean {
    return n && !(n & (n - 1)) ? true : false;
}
// check if enum is flaggable
function checkIsFlaggable(enums: EnumItem[]): boolean {
    for (const e of enums) {
        const value = +e.value;
        if (isNaN(value)) {
            continue; // skipping none number value
        }
        if (value !== 0 && value !== 1 && !powerOfTwo(value)) {
            return false;
        }
    }
    return true;
}

export interface _TypescriptEnum {
    [key: string | number]: number | string;
}

export function adaptTypescriptEnum(map: _TypescriptEnum | string[]) {
    if (Array.isArray(map)) {
        let mm: _TypescriptEnum | null = null;
        // create map as flaggable enum
        mm = {};
        for (let i = 0; i < map.length; i++) {
            mm[map[i]] = 1 << i;
        }
        return mm;
    }
    return map as _TypescriptEnum;
}

/**
 * @class Enum
 * @constructor
 * Represents an Enum with enum items.
 * @param {Array || Object}  map     This are the enum items.
 */
export class Enum {
    private readonly enumItems: EnumItem[];
    private readonly _isFlaggable: boolean;

    constructor(map: _TypescriptEnum | string[]) {
        this.enumItems = [];
        let mm: _TypescriptEnum | null = null;
        let isFlaggable = null;
        if (Array.isArray(map)) {
            mm = adaptTypescriptEnum(map);
            isFlaggable = true;
        } else {
            mm = map;
        }

        for (const key of Object.keys(mm)) {
            if (typeof key !== "string") {
                continue;
            }
            const val = mm[key] as number;
            if (undefined === val) {
                continue;
            }
            const kv = new EnumItem(key, val);

            const pThis = this as any;
            pThis[key] = kv;
            pThis[val] = kv;

            this.enumItems.push(kv);
        }

        if (!isFlaggable) {
            isFlaggable = checkIsFlaggable(this.enumItems);
        }
        this._isFlaggable = isFlaggable;
    }

    public get isFlaggable(): boolean {
        return this._isFlaggable;
    }
    /**
     * Returns the appropriate EnumItem.
     * @method get
     * @param  key The object to get with.
     * @return the get result.
     */
    public get(key: EnumItem | string | number): EnumItem | null {
        const pThis = this as any;
        if (key instanceof EnumItem) {
            if (!pThis[key.key]) {
                throw new Error("Invalid key");
            }
            return key;
        }

        if (key === null || key === undefined) {
            return null;
        }
        const prop = pThis[key];
        if (prop) {
            return prop;
        } else if (this._isFlaggable) {
            if (typeof key === "string") {
                return this._getByString(key);
            } else if (typeof key === "number") {
                return this._getByNum(key);
            }
        }
        return null;
    }

    public getDefaultValue(): EnumItem {
        return this.enumItems[0];
    }

    public toString(): string {
        return this.enumItems.join(" , ");
    }

    private _getByString(key: string): EnumItem | null {
        const pThis = this as any;
        const parts = key.split(" | ");

        let val = 0;
        for (const part of parts) {
            const item = pThis[part];
            if (undefined === item) {
                return null;
            }
            val |= item.value;
        }
        const kv = new EnumItem(key, val);

        // add in cache for later
        let prop = pThis[val];
        if (prop === undefined) {
            pThis[val] = kv;
        }
        prop = pThis[key];
        if (prop === undefined) {
            pThis[key] = kv;
        }
        return kv;
    }

    private _getByNum(key: number): EnumItem | null {
        if (key === 0) {
            return null;
        }
        const pThis = this as any;

        let name;
        let c = 1;
        for (let i = 0; c < key; i++) {
            if ((c & key) === c) {
                const item = pThis[c];
                if (undefined === item) {
                    return null;
                }
                if (name) {
                    name = name + " | " + item.key;
                } else {
                    name = item.key;
                }
            }
            c *= 2;
        }
        const kv = new EnumItem(name, key);
        // add in cache for later
        pThis[name] = kv;
        pThis[key] = kv;
        return kv;
    }
}
