const dumpIf = require("..").dumpIf;

describe("dumpIf",function() {


    let old_console_log;
    beforeEach(function () {
        old_console_log = console.log;
        console.log = function () {
        };
    });
    afterEach(function () {
        console.log = old_console_log;
    });


    it("dumpIf", function () {
        dumpIf(true, {"hello": "world"});
    });

});
