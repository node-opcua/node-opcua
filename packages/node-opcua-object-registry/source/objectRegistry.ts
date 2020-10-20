/**
 * @module node-opcua-object-registry
 */
import { assert } from "node-opcua-assert";
import { traceFromThisProjectOnly } from "node-opcua-debug";

const gRegistries: ObjectRegistry[] = [];
let hashCounter = 1;

export class ObjectRegistry {
    public static doDebug = false;
    public static registries: any = gRegistries;

    private _objectType: any;
    private readonly _cache: any;

    constructor(objectType?: any) {
        this._objectType = objectType;
        this._cache = {};
        gRegistries.push(this);
    }

    public getClassName(): string {
        return this._objectType ? this._objectType.name : "<???>";
    }

    public register(obj: any): void {
        if (!this._objectType) {
            this._objectType = obj.constructor;
        }

        if (!obj._____hash) {
            obj._____hash = hashCounter;
            hashCounter += 1;
            this._cache[obj._____hash] = obj;
        }

        // istanbul ignore next
        if (ObjectRegistry.doDebug) {
            obj._____trace = traceFromThisProjectOnly();
        }
    }

    public unregister(obj: any): void {
        this._cache[obj._____hash] = null;
        obj._____trace = null;
        delete this._cache[obj._____hash];
    }

    public count(): number {
        return Object.keys(this._cache).length;
    }

    public toString(): string {
        const className = this.getClassName();
        let str = " className :" + className + " found => " + this.count() + " object leaking\n";

        Object.values(this._cache).forEach((obj: any /*,key*/) => {
            str += obj.constructor.name + " " + obj.toString() + "\n";
        });

        if (ObjectRegistry.doDebug) {
            Object.values(this._cache).forEach((obj: any, key) => {
                const cachedObject = this._cache[key];
                if (!cachedObject) return;
                assert(cachedObject.hasOwnProperty("_____trace"));
                str += "   " + key + cachedObject._____trace + "\n";
            });
        }
        return str;
    }
}
