// tslint:disable:no-var-requires
// tslint:disable:no-empty

import { OPCUAClient, OPCUAServer } from "node-opcua";

const should = require("should");
const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing monitoring Executable flags on methods", () => {

    let server: OPCUAServer;
    let endpointUrl: any;

    let port = 20000;

    before((done) => {
        port += 1;

        const options = {port};
        server = new OPCUAServer(options);

        server.on("post_initialize", () => {
        });
        server.start((err?: Error) => {
            if (err) {
                return done(err);
            }
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            if (err) {
                return done(err);
            }
            done();
        });
    });

    beforeEach((done) => {
        done();
    });

    afterEach((done) => {
        done();
    });
    after( async () => {
        await server.shutdown();
    });
    it("should browse a variable", async () => {

        const client = OPCUAClient.create({});
        await client.connect(endpointUrl);
        await client.disconnect();
    });
});
