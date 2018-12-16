import * as should from "should";
import { ServerState, ServerStatusDataType } from "..";
const _should = should;
should(true).eql(true);

describe("testing ServerStatusDataType", () => {

   it("should create a ServerStatusDataType",  ()  => {

       const serverStatusDataType = new ServerStatusDataType({});

       serverStatusDataType.setState("Unknown");
       serverStatusDataType.state.should.eql(ServerState.Unknown);

       serverStatusDataType.setState(ServerState.Running);
       serverStatusDataType.state.should.eql(ServerState.Running);

       serverStatusDataType.setState(ServerState.CommunicationFault);
       serverStatusDataType.state.should.eql(ServerState.CommunicationFault);

       serverStatusDataType.setState("Running");
       serverStatusDataType.state.should.eql(ServerState.Running);
   });
});
