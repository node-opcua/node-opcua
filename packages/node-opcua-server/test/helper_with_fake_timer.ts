import { assert } from "node-opcua-assert";
import sinon from "sinon";

export async function with_fake_timer(this: any, workerFunc: (this: any, a: any) => void) {
    assert(!this.clock);

    this.clock = sinon.useFakeTimers();
    let theError: Error | undefined = undefined;
    try {
        await workerFunc.call(this, this);
    } catch (err) {
        theError = err as Error;
    }
    this.clock.restore();
    this.clock = undefined;
    if (theError) {
        throw theError;
    }
}
