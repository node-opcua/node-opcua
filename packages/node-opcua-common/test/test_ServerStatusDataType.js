"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const should = require("should");
const _should = should;
should(true).eql(true);
describe("testing ServerStatusDataType", () => {
    it("should create a ServerStatusDataType", () => {
        const serverStatusDataType = new __1.ServerStatusDataType({});
        serverStatusDataType.setState("Unknown");
        serverStatusDataType.state.should.eql(__1.ServerState.Unknown);
        serverStatusDataType.setState(__1.ServerState.Running);
        serverStatusDataType.state.should.eql(__1.ServerState.Running);
        serverStatusDataType.setState(__1.ServerState.CommunicationFault);
        serverStatusDataType.state.should.eql(__1.ServerState.CommunicationFault);
        serverStatusDataType.setState("Running");
        serverStatusDataType.state.should.eql(__1.ServerState.Running);
    });
});
//# sourceMappingURL=test_ServerStatusDataType.js.map