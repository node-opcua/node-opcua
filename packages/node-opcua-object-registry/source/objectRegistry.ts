/**
 * @module node-opcua-object-registry
 */
import { traceFromThisProjectOnly } from "node-opcua-debug";

const gRegistries: ObjectRegistry[] = [];
let hashCounter = 1;

export interface RegisteredObject {
    // biome-ignore lint/complexity/noBannedTypes: constructor is a function
    constructor: Function;
    _____hash?: number;
    _____trace?: Error;
    toString?(): string;
}

export class ObjectRegistry {
    public static doDebug = false;
    public static registries: ObjectRegistry[] = gRegistries;

    private _objectTypeName?: string;
    private readonly _cache: Record<string, WeakRef<RegisteredObject> | RegisteredObject>;

    constructor() {
        this._cache = {};
        gRegistries.push(this);
    }

    public getClassName(): string {
        return this._objectTypeName ? this._objectTypeName : "<???>";
    }

    public register(obj: RegisteredObject): void {
        if (!this._objectTypeName) {
            this._objectTypeName = obj.constructor.name;
        }

        if (!obj._____hash) {
            obj._____hash = hashCounter;
            hashCounter += 1;
            this._cache[obj._____hash] = typeof WeakRef !== "undefined" ? new WeakRef(obj) : obj;
        }

        // c8 ignore next
        if (ObjectRegistry.doDebug) {
            // we capture the stack without processing it immediately to avoid massive CPU overhead at runtime
            obj._____trace = new Error("Trace captured at registration");
        }
    }

    public unregister(obj: RegisteredObject): void {
        if (obj._____hash === undefined) return;
        delete this._cache[obj._____hash];
        obj._____trace = undefined;
    }

    private *_yieldAliveObjects(): IterableIterator<[string, RegisteredObject]> {
        for (const [key, cachedObject] of Object.entries(this._cache)) {
            const obj = cachedObject instanceof WeakRef ? cachedObject.deref() : cachedObject;
            if (obj) {
                yield [key, obj as RegisteredObject];
            } else {
                delete this._cache[key]; // Autoclean dead weak refs!
            }
        }
    }

    public count(): number {
        let cnt = 0;
        for (const _ of this._yieldAliveObjects()) {
            cnt++;
        }
        return cnt;
    }

    public toString(): string {
        const className = this.getClassName();
        let str = ` className :${className} found => ${this.count()} object leaking\n`;

        for (const [, obj] of this._yieldAliveObjects()) {
            str += `${obj.constructor.name} ${obj.toString ? obj.toString() : ""}\n`;
        }

        if (ObjectRegistry.doDebug) {
            for (const [key, obj] of this._yieldAliveObjects()) {
                const trace = obj._____trace ? traceFromThisProjectOnly(obj._____trace) : "<no trace>";
                str += `   ${key}${trace}\n`;
            }
        }
        return str;
    }
}

ObjectRegistry.doDebug = typeof process === "object" ? !!process?.env?.NODEOPCUA_REGISTRY?.match(/DEBUG/) : false;
if (ObjectRegistry.doDebug) {
    console.log("ObjectRegistry.doDebug = ", ObjectRegistry.doDebug);
}
