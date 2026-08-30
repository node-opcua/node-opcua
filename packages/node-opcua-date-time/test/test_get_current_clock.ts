import { coerceClock, getCurrentClock, getCurrentClockWithJavascriptDate, getMinOPCUADate, isMinDate } from "..";
import "should";
import sinon from "sinon";

describe("getCurrentClockWithJavascriptDate", () => {
    it("should provide a different picoseconds is time is similar", () => {
        const t1 = getCurrentClockWithJavascriptDate();
        const t2 = getCurrentClockWithJavascriptDate();
        const _t3 = getCurrentClockWithJavascriptDate();

        if (t1.timestamp.getTime() === t2.timestamp.getTime()) {
            t2.picoseconds.should.be.greaterThan(t1.picoseconds);
        } else {
            t2.timestamp.getTime().should.be.greaterThan(t1.timestamp.getTime());
        }
    });

    it("with sinon spy()", async () => {
        const _t1 = getCurrentClock();

        await new Promise((resolve) => setTimeout(resolve, 100));

        const _t2 = getCurrentClock();
    });
    it("with sinon spy()", () => {
        const fakeTimer = sinon.useFakeTimers(getMinOPCUADate());

        const _t1 = getCurrentClock();
        fakeTimer.tick(1000);
        const _t2 = getCurrentClock();

        fakeTimer.restore();
    });

    it("coerceClock", () => {
        const a = coerceClock(null, 10);
        coerceClock(a.timestamp, a.picoseconds);
    });
    it("isMinDate", () => {
        isMinDate(getMinOPCUADate()).should.eql(true);
    });
});
