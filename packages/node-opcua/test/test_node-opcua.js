const should = require("should");
const opcua = require("..");
describe("module 'node-opcua' module sanity test", function () {
    it("module 'node-opcua' should not export any null properties", function () {
//        console.log(Object.keys(opcua).join(" "));
        Object.keys(opcua).forEach(function (x) {
            if (opcua[x] === null) return;
            should.exist(opcua[x], x + " should be defined");
        });
    });
});
