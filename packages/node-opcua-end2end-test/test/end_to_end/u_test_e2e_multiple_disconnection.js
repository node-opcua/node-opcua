"use strict";
const should = require("should");
const { OPCUAClient } = require("node-opcua");
const { messageLogger } = require("node-opcua-debug");
const sinon = require("sinon");

module.exports = function (test) {
    describe("CDC-1 multiple disconnection", function () {
        let client, endpointUrl;
        let spyFunc;
        beforeEach(function (done) {
            client = OPCUAClient.create();
            endpointUrl = test.endpointUrl;

            spyFunc = sinon.spy();
            messageLogger.on("warningMessage", spyFunc);

            done();
        });
        function getWarnings() {
            const msg = spyFunc
            .getCalls()
            .map((x) => x.args[0])
            .join(" ");
            spyFunc.resetHistory();
            return msg;
        }

        afterEach(function (done) {
            client = null;
            done();
        });

        it("CDC-1 - disconnect, then connect, then disconnect", async () => {
            await client.disconnect();
            getWarnings().should.match(/\[NODE-OPCUA-W20] OPCUAClient#disconnect called while already disconnecting or disconnected/);
            await client.connect(endpointUrl);
            await client.disconnect();
            getWarnings().should.not.match(/\[NODE-OPCUA-W20]/);
        });
        it("CDC-2 - disconnect, then connect, then disconnect, then connect, then disconnect", async () => {
            await client.connect(endpointUrl);
            await client.disconnect();
            await client.connect(endpointUrl);
            await client.disconnect();
            getWarnings().should.not.match(/\[NODE-OPCUA-W20]/);
        });
        it("CDC-3 - disconnect while disconnecting", async () => {
            await client.connect(endpointUrl);
            const promise = client.disconnect();
            await client.disconnect();
            await promise;
            getWarnings().should.match(/\[NODE-OPCUA-W20] OPCUAClient#disconnect called while already disconnecting or disconnected/);
        });
    });
};
