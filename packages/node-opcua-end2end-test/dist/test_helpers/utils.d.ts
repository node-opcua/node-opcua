import type { EventEmitter } from "node:events";
export declare function wait(duration: number): Promise<unknown>;
export declare function waitUntilCondition(condition: () => Promise<boolean> | boolean, timeout: number, message?: string): Promise<void>;
export declare function waitForEvent(emitter: EventEmitter, event: string, timeoutMs: number): Promise<void>;
export declare const stepLog: (message: string) => void;
export declare const tracelog: (...args: [string | number, ...(string | number)[]]) => void;
//# sourceMappingURL=utils.d.ts.map