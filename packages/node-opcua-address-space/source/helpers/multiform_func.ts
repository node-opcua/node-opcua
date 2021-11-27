import { assert } from "console";
import { CallbackT } from "node-opcua-status-code";

export type StraightFunc<T, This> = (this: This) => T;
export type PromiseFunc<T, This> = (this: This) => Promise<T>;
export type CallbackFunc<T, This> = (this: This, callback: CallbackT<T>) => void;
export type MultiformFunc<T, This> = StraightFunc<T, This> | PromiseFunc<T, This> | CallbackFunc<T, This>;

export function convertToCallbackFunction<T, This>(func: MultiformFunc<T, This>): CallbackFunc<T, This> {
    if (func.length === 0) {
        return function (this: This, callback: CallbackT<T>) {
            /** */
            let valueOrPromise: T | Promise<T>;
            try {
                valueOrPromise = (func as (this: This) => Promise<T> | T).call(this);
            } catch (err) {
                return callback(err as Error);
            }
            if (valueOrPromise instanceof Promise) {
                valueOrPromise.then((value: T) => callback(null, value)).catch((err) => callback(err));
            } else {
                return callback(null, valueOrPromise);
            }
        };
    } else {
        if (func.length !== 1) {
            throw new Error("convertToCallbackFunction: invalid function");
        }

        return function (this: This, callback: CallbackT<T>) {
            try {
                (func as CallbackFunc<T, This>).call(this, callback);
            } catch (err) {
                console.log("internal error", (err as Error).message);
                callback(err as Error);
            }
        };
    }
}

export type StraightFunc1<T, P, This> = (this: This, param1: P) => T;
export type PromiseFunc1<T, P, This> = (this: This, param1: P) => Promise<T>;
export type CallbackFunc1<T, P, This> = (this: This, param1: P, callback: CallbackT<T>) => void;
export type MultiformFunc1<T, P, This> = StraightFunc1<T, P, This> | PromiseFunc1<T, P, This> | CallbackFunc1<T, P, This>;

export function convertToCallbackFunction1<T, P, This>(func: MultiformFunc1<T, P, This>): CallbackFunc1<T, P, This> {
    if (func.length === 1) {
        return function (this: This, param: P, callback: CallbackT<T>) {
            /** */
            let valueOrPromise: T | Promise<T>;
            try {
                valueOrPromise = (func as (this: This, param: P) => Promise<T> | T).call(this, param);
            } catch (err) {
                return callback(err as Error);
            }
            if (valueOrPromise instanceof Promise) {
                valueOrPromise.then((value: T) => callback(null, value)).catch((err) => callback(err));
            } else {
                return callback(null, valueOrPromise);
            }
        };
    } else {
        if (func.length !== 2) {
            throw new Error("convertToCallbackFunction: invalid function");
        }

        return function (this: This, param: P, callback: CallbackT<T>) {
            try {
                (func as CallbackFunc1<T, P, This>).call(this, param, callback);
            } catch (err) {
                console.log("internal error", (err as Error).message);
                callback(err as Error);
            }
        };
    }
}
