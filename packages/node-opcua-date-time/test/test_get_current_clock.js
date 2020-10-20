
const { getCurrentClockWithJavascriptDate, getCurrentClock, minOPCUADate, coerceClock, isMinDate } = require("..");
const should = require("should");
const sinon = require("sinon");

describe("getCurrentClockWithJavascriptDate", () => {


    it("should provide a different picoseconds is time is similar", () => {
        const t1 = getCurrentClockWithJavascriptDate();
        const t2 = getCurrentClockWithJavascriptDate();
        const t3 = getCurrentClockWithJavascriptDate();

        if (t1.timestamp.getTime() === t2.timestamp.getTime()) {
            t2.picoseconds.should.be.greaterThan(t1.picoseconds);
        } else {
            t2.timestamp.getTime().should.be.greaterThan(t1.timestamp.getTime());

        }
    })

    it("with sinon spy()", async () => {
        const t1 = getCurrentClock();

        await new Promise((resolve) => setTimeout(resolve, 100));

        const t2 = getCurrentClock();
    });
    it("with sinon spy()", () => {

        const fakeTimer = sinon.useFakeTimers(minOPCUADate);

        const t1 = getCurrentClock();
        fakeTimer.tick(1000);
        const t2 = getCurrentClock();

        fakeTimer.restore();
    });

    it("coerceClock", () => {
        const a = coerceClock(0, 10);
        coerceClock(a);

    });
    it("isMinDate", () => {
        isMinDate(minOPCUADate).should.eql(true);
    })
});
