import type { ErrorCallback } from "node-opcua-client";
export declare function fCallback(doDebug: boolean, func: (callback: ErrorCallback) => void): (callback: ErrorCallback) => void;
export declare function fAsync<T>(doDebug: boolean, func: () => Promise<T>): () => Promise<T>;
//# sourceMappingURL=display_function_name.d.ts.map