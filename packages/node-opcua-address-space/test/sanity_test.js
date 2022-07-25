const should = require("should");
describe("node-opcua-address-space module sanity test ", function () {
    it("module 'node-opcua-address-space' should not export any null properties", function () {
        const opcua = require("..");
        Object.keys(opcua).forEach(function (x) {
            should.exist(opcua[x], x + " should be defined");
        });
    });
});
