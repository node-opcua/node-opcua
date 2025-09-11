import "should";
import { OPCUAClient, DataType, StatusCodes, AttributeIds, OPCUAServer, NodeId } from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { build_address_space_for_conformance_testing } from "node-opcua-address-space-for-conformance-testing";
// NodeCrawler is deprecated but unit tests are still run
// to trap potential issues.
import { NodeCrawler } from "node-opcua-client-crawler";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";


const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("NodeCrawlerBase after write", function (this: Mocha.Runnable) {
    const port = 2012;

    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    this.timeout(process.arch === "arm" ? 800000 : 200000);

    let server: OPCUAServer;
    let client: OPCUAClient;
    let temperatureVariableId: NodeId;
    let endpointUrl: string;

    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        //port+=1;
        server = await build_server_with_temperature_device({ port });

        await build_address_space_for_conformance_testing(server.engine.addressSpace!, { mass_variables: false });

        endpointUrl = server.getEndpointUrl();
        temperatureVariableId = (server as any).temperatureVariableId;
    });

    beforeEach(async () => {
        client = OPCUAClient.create({
            requestedSessionTimeout: 60 * 1000 * 4 // 4 minutes
        });
        client.on("backoff", (count, delay) => {
            console.log("Backoff ", endpointUrl);
        });
    });

    afterEach(() => {

    });

    after(async () => {
        await server.shutdown();
    });

    it("should crawl, write to node, and crawl again", async () => {
        await perform_operation_on_client_session(
            client,
            endpointUrl,
            async (session) => {

                {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    const obj: any = await crawler.read(nodeId);

                    obj.browseName.toString().should.equal("Root");
                    obj.organizes.length.should.equal(3);
                    obj.organizes[0].browseName.toString().should.eql("Objects");
                    obj.organizes[1].browseName.toString().should.eql("Types");
                    obj.organizes[2].browseName.toString().should.eql("Views");
                    obj.typeDefinition.should.eql("FolderType");

                    crawler.dispose();
                }

                {
                    const nodeId = "ns=2;s=Static_Scalar_Boolean"; // coerceNodeId(2294);

                    const variantValue = {
                        dataType: DataType.Boolean,
                        value: true
                    };

                    const nodeToWrite = {
                        nodeId,
                        attributeId: AttributeIds.Value,
                        value: {
                            value: variantValue
                        }
                    };
                    const results = await session.write(nodeToWrite);
                    results.should.eql(StatusCodes.Good);
                }
                {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    const obj: any = await crawler.read(nodeId);
                    obj.browseName.toString().should.equal("Root");
                    obj.organizes.length.should.equal(3);
                    obj.organizes[0].browseName.toString().should.eql("Objects");
                    obj.organizes[1].browseName.toString().should.eql("Types");
                    obj.organizes[2].browseName.toString().should.eql("Views");
                    obj.typeDefinition.should.eql("FolderType");
                    crawler.dispose();
                }
            });
    });

});

