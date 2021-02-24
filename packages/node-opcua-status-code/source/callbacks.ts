/**
 * @module node-opcua-status-codes
 */
import { StatusCode } from "./opcua_status_code";

export type ErrorCallback = (err?: Error) => void;
export type Callback2<T> = (err: Error | null, result?: T) => void;
export type CallbackT<T> = (err: Error | null, result?: T) => void;
export type StatusCodeCallback = CallbackT<StatusCode>;
export type CallbackWithData = CallbackT<Buffer>;
export type Callback<T> = (err: Error | null, result?: T) => void;
