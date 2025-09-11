import "should"; // side-effect assertion lib
import { makeBrowsePath, OPCUAClient, StatusCodes, VariantArrayType, DataType, NodeIdLike } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

async function translateBrowsePathToNodeId(session: any, startingNode: NodeIdLike, relativePath: string) {
    const browsePath = makeBrowsePath(startingNode, relativePath);
    const result = await session.translateBrowsePath(browsePath);
    if (!result || !Array.isArray(result.targets) || result.targets.length === 0) {
        throw new Error(`Cannot translate browse path ${relativePath} from ${startingNode}`);
    }
    return result.targets[0].targetId;
}

export function t(test: TestHarness) {
    describe("Issue #223 - Demonstrate client call service usage", () => {
        it("#223 - calling a method with one input argument", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});
            await client.connect(endpointUrl);
            const session = await client.createSession();

            try {
                // Locate ObjectWithMethods under Simulation
                const objectWithMethodsNodeId = await translateBrowsePathToNodeId(
                    session,
                    "RootFolder",
                    "/Objects/2:Simulation/2:ObjectWithMethods"
                );
                // Locate MethodIO method relative to object
                const methodIONodeId = await translateBrowsePathToNodeId(session, objectWithMethodsNodeId, ".2:MethodIO");

                const methodsToCall = [
                    {
                        objectId: objectWithMethodsNodeId,
                        methodId: methodIONodeId,
                        inputArguments: [
                            {
                                dataType: DataType.UInt32,
                                arrayType: VariantArrayType.Scalar,
                                value: 32
                            }
                        ]
                    }
                ];

                const results = await session.call(methodsToCall as any);
                const callResults = Array.isArray(results) ? results : [results];
                callResults.length.should.eql(1);
                callResults[0].statusCode.should.eql(StatusCodes.Good);
            } finally {
                await session.close();
                await client.disconnect();
            }
        });
    });
}