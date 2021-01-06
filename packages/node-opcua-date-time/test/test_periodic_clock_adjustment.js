
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

        periodicClockAdjustment.timerInstallationCount.should.eql(0,"when test starts timerInstallationCount shall be ZERO");
        installPeriodicClockAdjustment();
        

        const initialValue = periodicClockAdjustment.adjustmentCount;
        await new Promise((resolve) => setTimeout(resolve, 200));
        (periodicClockAdjustment.adjustmentCount - initialValue).should.be.greaterThan(0);
        uninstallPeriodicClockAdjustment();
    });

})