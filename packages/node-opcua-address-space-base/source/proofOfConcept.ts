import { EventEmitter } from "node:events";
import { NodeClass } from "node-opcua-data-model";

interface IEventData {
    source: string;
}
interface DataValue {
    value: number;
}
interface NumericRange {
    start: number;
    end: number;
}
export interface BaseNodeEvents {
    dispose: () => void;
    event: (attribute: IEventData) => void;
}

export interface UAObjectEvents extends BaseNodeEvents {
    Value_changed: (attribute: DataValue) => void;
    DisplayName_changed: (attribute: DataValue) => void;
    Description_changed: (attribute: DataValue) => void;
    BrowseName_changed: (attribute: DataValue) => void;
    RolePermissions_changed: (attribute: DataValue) => void;
    AccessRestrictions_changed: (attribute: DataValue) => void;
}

// Self-referential constraint: every property of L must be a function.
// Lets us drop the broken `T[K] extends (...) => ...` conditionals while
// preserving exact callback signatures (named params, optional args) for IntelliSense.
export type ListenerSignature<L> = {
    // biome-ignore lint/suspicious/noExplicitAny: any is required to bypass function-parameter contravariance; using unknown breaks T[K] assignability
    [E in keyof L]: (...args: any[]) => any;
};

export interface ITypedEventEmitter<T extends ListenerSignature<T>> {
    on<K extends keyof T>(event: K, listener: T[K]): this;
    once<K extends keyof T>(event: K, listener: T[K]): this;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): this;
    off<K extends keyof T>(event: K, listener: T[K]): this;
}

export class TypedEventEmitter<T extends ListenerSignature<T>> implements ITypedEventEmitter<T> {
    private emitter = new EventEmitter();

    on<K extends keyof T>(event: K, listener: T[K]): this {
        this.emitter.on(event as string, listener as never);
        return this;
    }

    once<K extends keyof T>(event: K, listener: T[K]): this {
        this.emitter.once(event as string, listener as never);
        return this;
    }

    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): this {
        this.emitter.emit(event as string, ...args);
        return this;
    }

    off<K extends keyof T>(event: K, listener: T[K]): this {
        this.emitter.off(event as string, listener as never);
        return this;
    }
}

// import { BaseNodeEvents } from './BaseNodeEvents';
// import { ITypedEventEmitter, TypedEventEmitter } from './TypedEventEmitter';
interface IAddressSpace {
    str: string;
}
export interface BaseNode<T extends BaseNodeEvents & ListenerSignature<T> = BaseNodeEvents> extends ITypedEventEmitter<T> {
    readonly nodeClass?: NodeClass;
    get addressSpace(): IAddressSpace;
}

export abstract class BaseNodeImpl<T extends BaseNodeEvents & ListenerSignature<T> = BaseNodeEvents>
    extends TypedEventEmitter<T>
    implements BaseNode<T>
{
    get addressSpace(): IAddressSpace {
        return this._addressSpace;
    }

    private _addressSpace: IAddressSpace = { str: "example" };
}

//

// import { BaseNode, IBaseNode } from "./BaseNode";
// import { BaseNodeEvents, UAObjectEvents } from "./BaseNodeEvents";

export interface UAObject<T extends UAObjectEvents & ListenerSignature<T> = UAObjectEvents> extends BaseNode<T> {
    nodeClass: NodeClass.Object;
    someUAObjectMethod(): void;
}

export class UAObjectImpl<T extends UAObjectEvents & ListenerSignature<T> = UAObjectEvents>
    extends BaseNodeImpl<T>
    implements UAObject<T>
{
    nodeClass: NodeClass.Object = NodeClass.Object;

    someUAObjectMethod(): void {
        // ...
    }
}

export interface UAVariableEvents extends BaseNodeEvents {
    value_changed: (newDataValue: DataValue, index_range?: NumericRange | null) => void;
    semantic_changed: () => void;
    trucmuch: (newDataValue: DataValue, index_range?: NumericRange | null) => void;
}
export interface UAVariable<T extends UAVariableEvents & ListenerSignature<T> = UAVariableEvents> extends BaseNode<T> {
    nodeClass: NodeClass.Variable;
    someUAVariableMethod(): void;
}

export class UAVariableImpl<T extends UAVariableEvents & ListenerSignature<T> = UAVariableEvents>
    extends BaseNodeImpl<T>
    implements UAVariable<T>
{
    nodeClass: NodeClass.Variable = NodeClass.Variable;
    someUAVariableMethod(): void {
        // ...
        (this as UAVariableImpl).emit("trucmuch", { value: 42 });
    }
}

const a = new UAVariableImpl();
a.on("trucmuch", (dataValue) => {
    console.log("trucmuch changed", dataValue.value);
});
a.emit("trucmuch", { value: 42 });

function onNodeFunc(node: BaseNode) {
    node.on("event", () => {});
}

function main() {
    const uaObject = new UAObjectImpl();

    uaObject.on("RolePermissions_changed", (dataValue) => {
        console.log("RolePermissions changed", dataValue.value);
    });

    const uaVariable: UAVariable = new UAVariableImpl();

    uaVariable.on("trucmuch", (dataValue, _indexRange) => {
        console.log("trucmuch changed", dataValue.value);
    });

    onNodeFunc(uaObject);
    onNodeFunc(uaVariable);
}
main();
