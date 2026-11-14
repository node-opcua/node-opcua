export declare class Queue<T> {
    private _d;
    size: number;
    constructor();
    clear(): void;
    first(): T | undefined;
    shift(): T | undefined;
    push(value: T): void;
    filterOut(predicate: (element: T) => boolean): number;
    values(): Iterable<T>;
}
//# sourceMappingURL=queue.d.ts.map