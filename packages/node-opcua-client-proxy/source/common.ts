export type ErrorCallback = (err?: Error) => void;
export type Callback<T> = (err: Error|null, returnValue?: T) => void;
