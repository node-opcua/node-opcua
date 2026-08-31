import { coerceLocalizedText, DataType, MethodIds, ObjectIds, OPCUAClient, ServerState, StatusCodes } from "node-opcua-client";
import should from "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
export function t(test: UmbrellaTestContext) {
    describe("issue#1086 calling method with enumeration in arguments", () => {
        it("should handle Enumeration in input arguments", async () => {
            const client = OPCUAClient.create({});
            await client.withSessionAsync(test.endpointUrl!, async (session) => {
                const result = await session.call({
                    methodId: MethodIds.Server_RequestServerStateChange,
                    objectId: ObjectIds.Server,
                    inputArguments: [
                        { dataType: DataType.Int32, value: ServerState.Shutdown },
                        { dataType: DataType.DateTime, value: new Date() },
                        { dataType: DataType.UInt32, value: 100 }, // second till shutdown
                        {
                            dataType: DataType.LocalizedText,
                            value: coerceLocalizedText({ text: "For maintenance", locale: "en_US" })
                        },
                        { dataType: DataType.Boolean, value: true }
                    ]
                });
                console.log(result.toString());
                should(result.inputArgumentResults?.[1]).eql(StatusCodes.Good);
                should(result.inputArgumentResults?.[3]).eql(StatusCodes.Good);
                should(result.inputArgumentResults?.[4]).eql(StatusCodes.Good);
                should(result.inputArgumentResults?.[0]).eql(StatusCodes.Good);
            });
        });
    });
}
