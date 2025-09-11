import "should";
import { AttributeIds, OPCUAClient } from "node-opcua";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

export function t(test: any) {

    describe("ClientSession#readVariableValue", function () {

        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });

        afterEach(async () => {
            await client.disconnect();
        });

        it("ClientSession#readVariableValue - case 1 - a single nodeId", async () => {

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                const dataValue = await session.readVariableValue("ns=0;i=2258");
                dataValue.should.not.be.instanceOf(Array);
            });
        });

        it("ClientSession#readVariableValue - case 2 - an array of nodeIds", async () => {

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                const dataValues = await session.readVariableValue(
                    [
                        "ns=0;i=2258",
                        "ns=0;i=2257"
                    ]);

                dataValues.should.be.instanceOf(Array);
                dataValues.length.should.eql(2);
                //xx console.log(" dataValue = ",results[0].toString());
                //xx console.log(" dataValue = ",results[1].toString());
            });
        });

        it("ClientSession#readVariableValue - case 3 - a single ReadValueId", async () => {

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                const readValueId1 = {
                    nodeId: "ns=0;i=2258",
                    attributeId: AttributeIds.BrowseName
                };
                const readValueId2 = {
                    nodeId: "ns=0;i=2258",
                    attributeId: AttributeIds.NodeClass
                };

                const results = await session.readVariableValue([
                    readValueId1,
                    readValueId2
                ]);
                results.should.be.instanceOf(Array);
                results.length.should.eql(2);

                results[0].value.value.name.should.eql("CurrentTime");
                results[1].value.value.should.eql(2);
            });
        });
    });
};
