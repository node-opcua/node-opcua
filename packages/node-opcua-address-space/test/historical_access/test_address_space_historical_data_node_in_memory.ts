import * as fs from "fs";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { HistoryData, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import { coerceNodeId } from "node-opcua-nodeid";

import { AddressSpace, ContinuationPoint, ContinuationPointManager, SessionContext } from "../..";
import { generateAddressSpace } from "../../nodeJS";
import { date_add } from "../../testHelpers";

// make sure extra error checking is made on object constructions
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node", () => {
    const context = new SessionContext({
        session: {
            continuationPointManager: new ContinuationPointManager(),
            getSessionId: () => coerceNodeId(1)
        }
    });
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        const namespace = addressSpace.registerNamespace("MyPrivateNamespace");
        namespace.namespaceUri.should.eql("MyPrivateNamespace");
        await generateAddressSpace(addressSpace, xml_files);
    });

    after(() => {
        addressSpace.dispose();
    });

    // eslint-disable-next-line max-statements
    it("HHM3- should keep values up to options.maxOnlineValues to provide historical reads", async () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar2",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 3 // Only very few values !!!!
        });

        (node as any)["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's inject some values into the history
        const today = new Date();

        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 10 }),
            isReadModified: false,
            numValuesPerNode: 1000,
            returnBounds: true,
            startTime: date_add(today, { seconds: -10 })
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint: ContinuationPoint | undefined = undefined;

        node.setValueFromSource(
            {
                dataType: "Double",
                value: 0
            },
            StatusCodes.Good,
            date_add(today, { seconds: 0 })
        );

        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));

        const historyReadResult1 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues1 = (historyReadResult1.historyData as HistoryData).dataValues!;
        dataValues1.length.should.eql(1);
        dataValues1[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));

        node.setValueFromSource(
            {
                dataType: "Double",
                value: 0
            },
            StatusCodes.Good,
            date_add(today, { seconds: 1 })
        );
        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));

        const historyReadResult2 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues2 = (historyReadResult2.historyData as HistoryData).dataValues!;
        dataValues2.length.should.eql(2);
        dataValues2[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
        dataValues2[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 }));

        node.setValueFromSource(
            {
                dataType: "Double",
                value: 0
            },
            StatusCodes.Good,
            date_add(today, { seconds: 2 })
        );
        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));

        const historyReadResult3 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues3 = (historyReadResult3.historyData as HistoryData).dataValues!;
        dataValues3.length.should.eql(3);
        dataValues3[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
        dataValues3[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 }));
        dataValues3[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 }));

        // the queue is full, the next insertion will cause the queue to be trimmed

        node.setValueFromSource(
            {
                dataType: "Double",
                value: 0
            },
            StatusCodes.Good,
            date_add(today, { seconds: 3 })
        );
        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 1 }));

        const historyReadResult4 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues4 = (historyReadResult4.historyData as HistoryData).dataValues!;
        dataValues4.length.should.eql(3);
        dataValues4[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 }));
        dataValues4[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 }));
        dataValues4[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 }));

        // the queue is (still)  full, the next insertion will cause the queue to be trimmed, again

        node.setValueFromSource(
            {
                dataType: "Double",
                value: 0
            },
            StatusCodes.Good,
            date_add(today, { seconds: 4 })
        );
        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 2 }));

        const historyReadResult5 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues5 = (historyReadResult5.historyData as HistoryData).dataValues!;
        dataValues5.length.should.eql(3);
        dataValues5[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 }));
        dataValues5[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 }));
        dataValues5[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 }));
    });
});
