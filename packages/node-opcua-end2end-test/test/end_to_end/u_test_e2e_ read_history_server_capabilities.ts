import should from "should";
import { OPCUAClient, readHistoryServerCapabilities } from "node-opcua-client";
export function t(test: any) {
    describe("ReadHistoryServerCapabilities", function () {
        it("should read history server capabilities", async () => {
            const client = OPCUAClient.create({});
            await client.withSessionAsync(test.endpointUrl, async (session) => {
                const cap = await readHistoryServerCapabilities(session);

                console.log(cap);

                cap.accessHistoryDataCapability.value.should.eql(false);
                cap.accessHistoryEventsCapability.value.should.eql(false);

                cap.maxReturnDataValues.value.should.eql(0);
                cap.maxReturnEventValues.value.should.eql(0);

                cap.deleteAtTimeCapability.value.should.eql(false);
                cap.deleteRawCapability.value.should.eql(false);
                cap.deleteEventCapability.value.should.eql(false);
                //        cap.deleteAnnotationCapability.value.should.eql(false);

                cap.insertAnnotationCapability.value.should.eql(false);
                cap.insertDataCapability.value.should.eql(false);
                cap.insertEventCapability.value.should.eql(false);

                cap.replaceDataCapability.value.should.eql(false);
                cap.replaceEventCapability.value.should.eql(false);
                //        cap.replaceAnnotationCapability.should.eql(false);

                cap.updateEventCapability.value.should.eql(false);
                cap.updateDataCapability.value.should.eql(false);
                //   cap.updateAnnotationCapability.should.eql(false);

                should(cap["aggregateFunctions/AnnotationCount"].value).eql(null);
            });
        });
    });
}
