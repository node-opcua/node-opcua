
const {
    periodicClockAdjustment,
    installPeriodicClockAdjustment,
    uninstallPeriodicClockAdjustment
} = require("..");


describe("installPeriodicClockAdjustment", () => {


    it("should install and uninstall", () => {
        installPeriodicClockAdjustment();
        uninstallPeriodicClockAdjustment();
    });
    it("should install and uninstall multiple time", () => {
        installPeriodicClockAdjustment();
        installPeriodicClockAdjustment();
        uninstallPeriodicClockAdjustment();
        uninstallPeriodicClockAdjustment();
    });

    it("should adjust clock", async () => {
        periodicClockAdjustment.interval = 100;
        installPeriodicClockAdjustment();
        periodicClockAdjustment.adjustmentCount.should.eql(0);

        await new Promise((resolve) => setTimeout(resolve, 200));

        periodicClockAdjustment.adjustmentCount.should.be.greaterThan(0);
        uninstallPeriodicClockAdjustment();
    });

})