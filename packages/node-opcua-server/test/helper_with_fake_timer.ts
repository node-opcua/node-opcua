import { assert } from "node-opcua-assert";
import sinon from "sinon";

export interface IContextWithFakeClock {
    clock?: sinon.SinonFakeTimers;
}
// the context type as seen from inside workerFunc, where the fake clock is guaranteed to be set
type IContextWithFakeClockSet<T> = T & { clock: sinon.SinonFakeTimers };

export async function with_fake_timer<T extends IContextWithFakeClock>(
    this: T,
    workerFunc: (this: IContextWithFakeClockSet<T>, a: IContextWithFakeClockSet<T>) => void
) {
    assert(!this.clock);

    const clock = sinon.useFakeTimers();
    this.clock = clock;
    const ctx = this as IContextWithFakeClockSet<T>;
    let theError: Error | undefined;
    try {
        await workerFunc.call(ctx, ctx);
    } catch (err) {
        theError = err as Error;
    }
    clock.restore();
    this.clock = undefined;
    if (theError) {
        throw theError;
    }
}
