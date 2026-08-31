import { dumpIf } from "../dist/index.js";

describe("dumpIf", () => {
    let old_console_log: typeof console.log;
    beforeEach(() => {
        old_console_log = console.log;
        console.log = () => {
            /** */
        };
    });
    afterEach(() => {
        console.log = old_console_log;
    });

    it("dumpIf", () => {
        dumpIf(true, { hello: "world" });
    });
});
