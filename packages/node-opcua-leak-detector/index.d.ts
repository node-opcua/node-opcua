export declare function describeWithLeakDetector(name: string, fn: () => void): void;
 
export declare function checkForMemoryLeak(beforeSnapshot: number, afterSnapshot: number): void;
export declare function takeMemorySnapshot(): number;
