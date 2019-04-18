import { nodesets } from "node-opcua-nodesets";
import { OPCUAServer } from "..";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServerEndpoint#addEndpointDescription", () => {

    it("should be possible to create endpoints on multiple host names", () => {


        // Given a server with two host names
        const server = new OPCUAServer({
            nodeset_filename: [ nodesets.standard ],

            alternateHostname: [ "1.2.3.4" , "MyName"]
        });

        // When we count the exposed endpoint
        let matching1234Count = 0;
        let matchingMyName = 0;

        for (const e of server.endpoints) {
            for (const ed of e.endpointDescriptions()) {
                // console.log("", ed.endpointUrl);
                if (ed.endpointUrl!.match(/1\.2\.3\.4/)) {
                    matching1234Count++;
                }
                if (ed.endpointUrl!.match(/MyName/)) {
                    matchingMyName++;
                }
            }
        }

        matching1234Count.should.eql(7, "we should have 7 endpoints matches the IP address");
        matchingMyName.should.eql(7, "we should have 7 endpoints matches the Hostname");

        server.dispose();
    });
});
