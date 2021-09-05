const should = require("should");
describe("node-opcua-adress-space module sanity test ", function () {
    it("module 'node-opcua-adress-space' should not export any null properties", function () {
        const opcua = require("..");
        Object.keys(opcua).forEach(function (x) {
            should.exist(opcua[x], x + " should be defined");
        });
    });
});
