import "should";
import {
    BrowsePath,
    OPCUAClient,
    OPCUAServer,
    ObjectIds,
    StatusCodes,
    VariableIds,
    makeBrowsePath,
    resolveNodeId

} from "node-opcua";

import {
    perform_operation_on_client_session
} from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
export function t(test: any) {


    describe("testing session#translateBrowsePath", function () {

        let server: OPCUAServer;
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
            server = test.server;
        });

        afterEach(() => {
        });


        it("TBP1 should translate browse path", async () => {

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                // find nodeId of Root.Objects.server.status.buildInfo
                const browsePath = [
                    makeBrowsePath("RootFolder", "/Objects/Server"),
                    makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus"),
                    makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus.BuildInfo"),
                    makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus.BuildInfo.ProductName"),
                    makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus.BuildInfo."), // missing TargetName !
                    makeBrowsePath("RootFolder", "/Objects.Server"), // intentional error usign . instead of /
                    makeBrowsePath("RootFolder", "/Objects/2:MatrikonOPC Simulation Server (DA)") // va
                ];

                //xx console.log("browsePath ", browsePath[0].toString({addressSpace: server.engine.addressSpace}));

                const results = await session.translateBrowsePath(browsePath);
                results.length.should.eql(browsePath.length);
                //xx console.log(results[0].toString());

                results[0].statusCode.should.eql(StatusCodes.Good);
                results[0].targets!.length.should.eql(1);
                results[0].targets![0].targetId.toString().should.eql("ns=0;i=2253");
                results[0].targets![0].targetId.value.should.eql(ObjectIds.Server);

                //xx console.log(results[1].toString());
                results[1].statusCode.should.eql(StatusCodes.Good);
                results[1].targets!.length.should.eql(1);
                results[1].targets![0].targetId.toString().should.eql("ns=0;i=2256");
                results[1].targets![0].targetId.value.should.eql(VariableIds.Server_ServerStatus);

                //xx console.log(results[2].toString());
                results[2].statusCode.should.eql(StatusCodes.Good);
                results[2].targets!.length.should.eql(1);
                results[2].targets![0].targetId.toString().should.eql("ns=0;i=2260");
                results[2].targets![0].targetId.value.should.eql(VariableIds.Server_ServerStatus_BuildInfo);

                //xx console.log(results[3].toString());
                results[3].statusCode.should.eql(StatusCodes.Good);
                results[3].targets!.length.should.eql(1);
                results[3].targets![0].targetId.toString().should.eql("ns=0;i=2261");
                results[3].targets![0].targetId.value.should.eql(VariableIds.Server_ServerStatus_BuildInfo_ProductName);

                // missing browseName on last element of the relativepath => ERROR
                results[4].statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);

                results[5].statusCode.should.eql(StatusCodes.BadNoMatch);

                results[6].statusCode.should.eql(StatusCodes.BadNoMatch);
            });
        });

        it("TBP2 server should return BadNothingToDo when the translateBrowsePath browse path relativePath is empty", async () => {

            /*
             CTT Test 5.7.3-Err-5
             Given an existent starting node and no RelativePath elements.
             When TranslateBrowsePathsToNodeIds is called server returns operation result Bad_NothingToDo.
             */

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                const browsePath = new BrowsePath({
                    startingNode: resolveNodeId("ObjectsFolder"), ///ec.makeNodeId(opcua.ObjectIds.Server),
                    relativePath: { // RelativePath
                        elements: []
                    }
                });
                const browsePathResult = await session.translateBrowsePath(browsePath);
                browsePathResult.schema.name.should.equal("BrowsePathResult");
                browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);
                //xx console.log(browsePathResult.toString())
                browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);
            });
        });
    });
};
