import "should";
import {
    OPCUAClient,
    StatusCodes,
    UnregisterNodesRequest,
    RegisterNodesRequest,
    DataType,
    AttributeIds,
    ServiceFault
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";

interface TestHarness { endpointUrl: string; [k: string]: any }

/**
 * End-to-end testing registerNodes / unregisterNodes service behavior.
 * Converted from callback-based JS to async/await TypeScript maintaining semantics.
 */
export function t(test: TestHarness) {
    describe("end-to-end testing registerNodes", () => {

        it("register nodes - BadNothingToDo", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const request = new RegisterNodesRequest({ nodesToRegister: [] });
                await assertThrow(async () => {
                    await new Promise((resolve, reject) => {
                        (session as any).performMessageTransaction(request, (err: any) => {
                            if (err) return reject(err); // expect rejection
                            resolve(undefined);
                        });
                    });
                }, /BadNothingToDo/);
            });
        });

        it("register nodes - Good", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const request = new RegisterNodesRequest({ nodesToRegister: ["ns=0;i=1"] });
                const response: any = await new Promise((resolve, reject) => {
                    (session as any).performMessageTransaction(request, (err: any, resp: any) => {
                        if (err) return reject(err);
                        resolve(resp);
                    });
                });
                response.registeredNodeIds.length.should.eql(1);
            });
        });

        it("unregister nodes - BadNothingToDo", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const request = new UnregisterNodesRequest({ nodesToUnregister: [] });
                const faultErr: any = await assertThrow(async () => {
                    await new Promise((resolve, reject) => {
                        (session as any).performMessageTransaction(request, (err: any) => {
                            if (err) return reject(err); // expected rejection
                            resolve(undefined);
                        });
                    });
                }, /BadNothingToDo/);
                // Extra validation of returned ServiceFault structure
                if (faultErr.response) {
                    faultErr.response.should.be.instanceOf(ServiceFault);
                    faultErr.response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                }
            });
        });

        it("unregister nodes - Good", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const request = new UnregisterNodesRequest({ nodesToUnregister: ["ns=0;i=1"] });
                await new Promise<void>((resolve, reject) => {
                    (session as any).performMessageTransaction(request, (err: any, resp: any) => {
                        if (err) return reject(err);
                        resp.should.be.ok();
                        resolve();
                    });
                });
            });
        });

        it("register nodes provides alias usable across operations", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const nodesToRegister = ["ns=2;s=Static_Scalar_Double"];
                const registeredNodeIds: string[] = await new Promise((resolve, reject) => {
                    (session as any).registerNodes(nodesToRegister, (err: any, ids: string[]) => {
                        if (err) return reject(err);
                        resolve(ids);
                    });
                });
                // Write via alias
                const nodeToWrite = {
                    nodeId: registeredNodeIds[0],
                    attributeId: AttributeIds.Value,
                    value: { value: { dataType: DataType.Double, value: 1000 } }
                };
                const statusCode = await session.write(nodeToWrite as any);
                statusCode.should.eql(StatusCodes.Good);

                // Read with original
                const dataValue1 = await session.read({ nodeId: nodesToRegister[0], attributeId: AttributeIds.Value });
                dataValue1.statusCode.should.eql(StatusCodes.Good);

                // Read with alias
                const dataValue2 = await session.read({ nodeId: registeredNodeIds[0], attributeId: AttributeIds.Value });
                dataValue2.statusCode.should.eql(StatusCodes.Good);

                registeredNodeIds[0].toString().should.not.eql(nodesToRegister[0].toString());
                dataValue1.statusCode.toString().should.eql(dataValue2.statusCode.toString());
                dataValue1.value.toString().should.eql(dataValue2.value.toString());

                // Optional cleanup
                await new Promise<void>((resolve) => {
                    (session as any).unregisterNodes(registeredNodeIds, () => resolve());
                });
            });
        });
    });
}
