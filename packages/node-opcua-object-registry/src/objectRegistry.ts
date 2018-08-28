import * as _ from "underscore";
import { assert } from "node-opcua-assert";
import { trace_from_this_projet_only } from "node-opcua-debug";

const gRegistries: ObjectRegistry[] = [];
let hashCounter = 1;

export class ObjectRegistry {

    private _objectType: any;
    private _cache: any;

    constructor(objectType: any) {

        this._objectType = objectType;
        this._cache = {};
        gRegistries.push(this);
    }

    static doDebug = false;

    static registries: any = gRegistries;

    getClassName() {
        return this._objectType ? this._objectType.name : "<???>";
    }

    register(obj: any) {

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
            obj._____trace = trace_from_this_projet_only();
        }
    }

    unregister(obj: any) {
        this._cache[obj._____hash] = null;
        delete this._cache[obj._____hash];
    }

    count() {
        return Object.keys(this._cache).length;
    }

    toString() {

        const className = this.getClassName();
        let str = " className :" + className + " found => " + this.count() + " object leaking\n";

        _.forEach(this._cache, function (obj/*,key*/) {
            str += obj.constructor.name + " " + obj.toString() + "\n";
        });

        if (ObjectRegistry.doDebug) {
            _.forEach(this._cache, (obj, key) => {
                const cachedObject = this._cache[key];
                assert(cachedObject.hasOwnProperty("_____trace"));
                str += "   " + key + cachedObject._____trace + "\n";
            });
        }
        return str;
    }
}
