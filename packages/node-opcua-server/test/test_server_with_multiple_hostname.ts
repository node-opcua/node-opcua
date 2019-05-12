import { nodesets } from "node-opcua-nodesets";
import { OPCUAServer } from "..";

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServerEndpoint#addEndpointDescription multiple hostname", () => {

    it("should be possible to create endpoints on multiple host names", async () => {
        
        // Given a server with two host names
        const server = new OPCUAServer({
            nodeset_filename: [ nodesets.standard ],

            alternateHostname: [ "1.2.3.4" , "MyName"]
        });

        await server.start();

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

        await server.shutdown();

        server.dispose();
    });
});
