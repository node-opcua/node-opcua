import {
    OPCUAClient,
    ClientSession,
    MethodIds,
    ObjectIds,
    DataType,
    ServerState,
    coerceLocalizedText,
    StatusCodes
} from "node-opcua-client";
export function t(test: any) {
    describe("issue#1086 calling method with enumeration in arguments", function () {
        it("should handle Enumeration in input arguments", async () => {
            const client = OPCUAClient.create({});
            await client.withSessionAsync(test.endpointUrl, async (session) => {
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
                result.inputArgumentResults![1].should.eql(StatusCodes.Good);
                result.inputArgumentResults![3].should.eql(StatusCodes.Good);
                result.inputArgumentResults![4].should.eql(StatusCodes.Good);
                result.inputArgumentResults![0].should.eql(StatusCodes.Good);
            });
        });
    });
}
