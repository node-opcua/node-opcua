// tslint:disable:max-line-length

import { promisify } from "util";
import * as fs from "fs";

import * as should from "should";

import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import {
    HistoryData,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import { WriteValueOptions } from "node-opcua-service-write";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { coerceNodeId, NodeId } from "node-opcua-nodeid";

import { AddressSpace, ContinuationPoint, ContinuationPointManager, SessionContext, UAVariable } from "../..";
import { generateAddressSpace } from "../../nodeJS";
import { date_add } from "../../testHelpers";

const sleep = promisify(setTimeout);

// make sure extra error checking is made on object constructions
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node", () => {
    let addressSpace: AddressSpace;

    const context = new SessionContext({
        session: {
            continuationPointManager: new ContinuationPointManager(),
            getSessionId: () => coerceNodeId(1)
        }
    });

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        await generateAddressSpace(addressSpace, xml_files);
        const namespace = addressSpace.registerNamespace("MyPrivateNamespace");
        namespace.namespaceUri.should.eql("MyPrivateNamespace");
    });
    after(() => {
        addressSpace.dispose();
    });

    it("HHH1- should create a 'HA Configuration' node", () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node);
        (node as any)["hA Configuration"].browseName.toString().should.eql("HA Configuration");
    });

    it("HHH2- should keep values in memory to provide historical reads", async () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar1",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });

        addressSpace.installHistoricalDataNode(node);

        (node as any)["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's inject some values into the history
        const today = new Date();

        node.setValueFromSource({ dataType: "Double", value: 0 }, StatusCodes.Good, date_add(today, { seconds: 0 }));
        node.setValueFromSource({ dataType: "Double", value: 1 }, StatusCodes.Good, date_add(today, { seconds: 1 }));
        node.setValueFromSource({ dataType: "Double", value: 2 }, StatusCodes.Good, date_add(today, { seconds: 2 }));
        node.setValueFromSource({ dataType: "Double", value: 3 }, StatusCodes.Good, date_add(today, { seconds: 3 }));
        node.setValueFromSource({ dataType: "Double", value: 4 }, StatusCodes.Good, date_add(today, { seconds: 4 }));
        node.setValueFromSource({ dataType: "Double", value: 5 }, StatusCodes.Good, date_add(today, { seconds: 5 }));
        node.setValueFromSource({ dataType: "Double", value: 6 }, StatusCodes.Good, date_add(today, { seconds: 6 }));

        (node as any)["hA Configuration"].startOfOnlineArchive.readValue().value.value.getTime().should.eql(today.getTime());

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

        const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        should.not.exist(historyReadResult.continuationPoint);
        historyReadResult.statusCode.should.eql(StatusCodes.Good);
        const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
        // xx console.log(dataValues);
        dataValues.length.should.eql(7);
        dataValues[0].value.value.should.eql(0);
        dataValues[1].value.value.should.eql(1);
        dataValues[2].value.value.should.eql(2);
        dataValues[3].value.value.should.eql(3);
        dataValues[4].value.value.should.eql(4);
        dataValues[5].value.value.should.eql(5);
    });

    it("HHH3- should store initial dataValue when historical stuff is set", async () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar42",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        const today = new Date();

        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 20 }),
            isReadModified: false,
            numValuesPerNode: 1000,
            returnBounds: true,
            startTime: date_add(today, { seconds: -10 })
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint: ContinuationPoint | undefined = undefined;

        node.setValueFromSource({ dataType: "Double", value: 3.14 });

        // install historical support after value has been set
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 3 // Only very few values !!!!
        });

        const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
        dataValues.length.should.eql(1);
        dataValues[0].value.value.should.eql(3.14);

        // wait a little bit to make sure that sourceTimestamp will change !
        await sleep(10);

        node.setValueFromSource({ dataType: "Double", value: 6.28 });

        const historyReadResult2 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues2 = (historyReadResult2.historyData as HistoryData).dataValues!;
        dataValues2.length.should.eql(2);
        dataValues2[0].value.value.should.eql(3.14);
        dataValues2[1].value.value.should.eql(6.28);
    });

    it("HHH4- #420 should be possible to set/unset historizing attribute ", async () => {
        // un-setting the historizing flag shall suspend value being collected
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar4",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 10 // Only very few values !!!!
        });
        (node as any)["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        const today = new Date();

        node.setValueFromSource({ dataType: "Double", value: 0 }, StatusCodes.Good, date_add(today, { seconds: 0 }));

        // turn_historizing_attribute_to_false
        const writeValue: WriteValueOptions = {
            attributeId: AttributeIds.Historizing,
            value: new DataValue({
                value: {
                    dataType: DataType.Boolean,
                    value: false
                }
            })
        };

        const statusCode = await node.writeAttribute(context, writeValue);
        statusCode.should.eql(StatusCodes.Good);

        node.historizing.should.eql(false);

        // lets_inject_some_values
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 1
            },
            StatusCodes.Good,
            date_add(today, { seconds: 1 })
        );
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 2
            },
            StatusCodes.Good,
            date_add(today, { seconds: 2 })
        );
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 3
            },
            StatusCodes.Good,
            date_add(today, { seconds: 3 })
        );

        //  turn_historizing_attribute_to_true(callback) {
        const writeValue2: WriteValueOptions = {
            attributeId: AttributeIds.Historizing,
            value: new DataValue({ value: { dataType: DataType.Boolean, value: true } })
        };
        const statusCode2 = await node.writeAttribute(context, writeValue2);
        statusCode2.should.eql(StatusCodes.Good);
        node.historizing.should.eql(true);

        // lets_inject_some_more_values(callback) {
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 4
            },
            StatusCodes.Good,
            date_add(today, { seconds: 4 })
        );
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 5
            },
            StatusCodes.Good,
            date_add(today, { seconds: 5 })
        );
        node.setValueFromSource(
            {
                dataType: "Double",
                value: 6
            },
            StatusCodes.Good,
            date_add(today, { seconds: 6 })
        );

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

        const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
            continuationPoint
        });

        const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
        dataValues.length.should.eql(4);

        dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
        // no data recorded
        dataValues[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 }));
        dataValues[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 5 }));
        dataValues[3].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 }));
    });

    describe("HRRM HistoryReadRawModified", () => {
        let node: UAVariable;
        const today = new Date(2010, 10, 10, 0, 0, 0);

        before(() => {
            node = addressSpace.getOwnNamespace().addVariable({
                browseName: "MyVar5",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
                dataType: "Double"
            });
            addressSpace.installHistoricalDataNode(node, {
                maxOnlineValues: 100 // Only very few values !!!!
            });
            (node as any)["hA Configuration"].browseName.toString().should.eql("HA Configuration");

            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 0
                },
                StatusCodes.Good,
                date_add(today, { seconds: 0 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 1
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 1 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 2
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 2 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 3
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 3 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 4
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 4 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 5
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 5 })
            );
            node.setValueFromSource(
                {
                    dataType: "Double",
                    value: 6
                },
                StatusCodes.Good,
                date_add(today, { seconds: 60 * 6 })
            );
        });

        it("HRRM-1 should be possible to retrieve the start date of a time series", async () => {
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: undefined,
                isReadModified: false,
                numValuesPerNode: 1,
                returnBounds: false,
                startTime: date_add(today, { seconds: -1000000 })
            });
            const indexRange = null;
            const dataEncoding = null;
            const continuationPoint: ContinuationPoint | undefined = undefined;

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint
            });

            const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;

            dataValues.length.should.eql(1);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");

            dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
        });
        it("HRRM-2 should be possible to retrieve the end date of a time series", async () => {
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: 100 * 60 }),
                isReadModified: false,
                numValuesPerNode: 1,
                returnBounds: false,
                startTime: undefined
            });
            const indexRange = null;
            const dataEncoding = null;
            const continuationPoint: ContinuationPoint | undefined = undefined;

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint
            });

            const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
            dataValues.length.should.eql(1);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
            dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 * 60 }));
        });

        it(
            "HRRM-3 should be possible to retrieve a limited number of value between " +
                "a start date  and a end date of a time series",
            async () => {
                const historyReadDetails = new ReadRawModifiedDetails({
                    endTime: date_add(today, { seconds: 60 * 8 }),
                    isReadModified: false,
                    numValuesPerNode: 3, // three at a time
                    returnBounds: false,
                    startTime: date_add(today, { seconds: -1000000 })
                });
                const indexRange = null;
                const dataEncoding = null;

                const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                    continuationPoint: null
                });
                historyReadResult.statusCode.should.eql(StatusCodes.Good);

                const dataValues = (historyReadResult.historyData as HistoryData).dataValues!;
                dataValues.length.should.eql(3);
                should.exist(historyReadResult.continuationPoint, "expecting a continuation point in our case");

                const continuationPoint: ContinuationPoint | undefined = historyReadResult.continuationPoint;
                dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
                dataValues[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 * 60 }));
                dataValues[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 * 60 }));

                //  make_first_continuation_read(callback) {
                const historyReadResult2 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                    continuationPoint
                });

                historyReadResult2.statusCode.should.eql(StatusCodes.Good);

                const dataValues2 = (historyReadResult2.historyData as HistoryData).dataValues!;
                dataValues2.length.should.eql(3);
                should.exist(historyReadResult2.continuationPoint, "expecting a continuation point in our case");

                const continuationPoint2: ContinuationPoint | undefined = historyReadResult2.continuationPoint;
                should(continuationPoint2).not.eql(null);
                should(continuationPoint2).eql(continuationPoint);

                dataValues2[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 * 60 }));
                dataValues2[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 * 60 }));
                dataValues2[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 5 * 60 }));

                // make_second_continuation_read(callback) {
                const historyReadResult3 = await node.historyRead(
                    context,
                    historyReadDetails,
                    indexRange,
                    dataEncoding,
                    { continuationPoint } // this continuation point is not valid any
                );

                historyReadResult3.statusCode.should.eql(StatusCodes.Good);

                const dataValues3 = (historyReadResult3.historyData as HistoryData).dataValues!;
                dataValues3.length.should.eql(1);
                should.not.exist(historyReadResult3.continuationPoint, "expecting no continuation point");

                dataValues3[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 * 60 }));

                //
                const historyReadResult4 = await node.historyRead(
                    context,
                    historyReadDetails,
                    indexRange,
                    dataEncoding,
                    { continuationPoint } // this continuation point is not valid any
                );
                historyReadResult4.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
            }
        );
        it("HRRM-4 should be possible to retrieve values in reverse order (no continuation point)", async () => {
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: -1000000 }),
                isReadModified: false,
                numValuesPerNode: 0, /// If numValuesPerNode is 0, then all the values in the range are returned.
                returnBounds: false,
                startTime: date_add(today, { seconds: +1000000 })
            });
            const indexRange = null;
            const dataEncoding = null;
            const continuationPoint: ContinuationPoint | undefined = undefined;

            const historyReadResult1 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint
            });

            const dataValues = (historyReadResult1.historyData as HistoryData).dataValues!;
            dataValues.length.should.eql(7);
            should.not.exist(historyReadResult1.continuationPoint, "expecting no continuation points in our case");

            dataValues[6].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
            dataValues[5].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 * 60 }));
            dataValues[4].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 * 60 }));
            dataValues[3].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 * 60 }));
            dataValues[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 * 60 }));
            dataValues[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 5 * 60 }));
            dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 * 60 }));
        });
        it("HRRM-5 should be possible to retrieve values in reverse order (and continuation points)", async () => {
            let continuationPoint: ContinuationPoint | undefined;

            const indexRange = null;
            const dataEncoding = null;
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: -1000000 }),
                isReadModified: false,
                numValuesPerNode: 3, /// Max
                returnBounds: false,
                startTime: date_add(today, { seconds: +1000000 })
            });

            const historyReadResult1 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            const dataValues1 = (historyReadResult1.historyData as HistoryData).dataValues!;
            dataValues1.length.should.eql(3);
            should.exist(historyReadResult1.continuationPoint, "expecting no continuation points in our case");

            continuationPoint = historyReadResult1.continuationPoint;

            dataValues1[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 * 60 }));
            dataValues1[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 5 * 60 }));
            dataValues1[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 * 60 }));

            const historyReadResult2 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint
            });

            const dataValues2 = (historyReadResult2.historyData as HistoryData).dataValues!;
            dataValues2.length.should.eql(3);
            should.exist(historyReadResult2.continuationPoint, "expecting no continuation points in our case");

            continuationPoint = historyReadResult2.continuationPoint;

            dataValues2[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 * 60 }));
            dataValues2[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 * 60 }));
            dataValues2[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 * 60 }));

            const historyReadResult3 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint
            });

            const dataValues3 = (historyReadResult3.historyData as HistoryData).dataValues!;
            dataValues3.length.should.eql(1);
            should.not.exist(historyReadResult3.continuationPoint, "expecting no continuation points in our case");

            dataValues3[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
        });
        it("HRRM-6 should return some data if endTime & numValuesPerNode, are specified (no startTime)", async () => {
            const indexRange = null;
            const dataEncoding = null;
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: +1000000 }),
                isReadModified: false,
                numValuesPerNode: 10000, /// Max
                returnBounds: false,
                startTime: undefined
            });

            const historyReadResult1 = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            const dataValues = (historyReadResult1.historyData as HistoryData).dataValues!;
            dataValues.length.should.eql(7);
            should.not.exist(historyReadResult1.continuationPoint, "expecting no continuation points in our case");

            dataValues[6].sourceTimestamp!.should.eql(date_add(today, { seconds: 0 }));
            dataValues[5].sourceTimestamp!.should.eql(date_add(today, { seconds: 1 * 60 }));
            dataValues[4].sourceTimestamp!.should.eql(date_add(today, { seconds: 2 * 60 }));
            dataValues[3].sourceTimestamp!.should.eql(date_add(today, { seconds: 3 * 60 }));
            dataValues[2].sourceTimestamp!.should.eql(date_add(today, { seconds: 4 * 60 }));
            dataValues[1].sourceTimestamp!.should.eql(date_add(today, { seconds: 5 * 60 }));
            dataValues[0].sourceTimestamp!.should.eql(date_add(today, { seconds: 6 * 60 }));
        });

        it("HRRM-7 should return an error if less than two constraints are specified (no endTime, no startTime)", async () => {
            const indexRange = null;
            const dataEncoding = null;
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: undefined,
                isReadModified: false,
                numValuesPerNode: 10000, /// Max
                returnBounds: false,
                startTime: undefined
            });

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            historyReadResult.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
        });

        it(
            "HRRM-8 should return an error if less than two constraints are specified " +
                "(endTime, no numValuesPerNode, no startTime)",
            async () => {
                const indexRange = null;
                const dataEncoding = null;
                const historyReadDetails = new ReadRawModifiedDetails({
                    endTime: date_add(today, { seconds: -1000000 }),
                    isReadModified: false,
                    numValuesPerNode: 0, /// Max
                    returnBounds: false,
                    startTime: undefined
                });

                const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                    continuationPoint: null
                });

                historyReadResult.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);

                should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
            }
        );

        it("HRED-1 [TODO] implement ReadEventDetails", async () => {
            const historyReadDetails = new ReadEventDetails({});
            const indexRange = null;
            const dataEncoding = null;

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            historyReadResult.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
        });

        it("HRPD-1 [TODO] implement ReadProcessedDetails", async () => {
            const historyReadDetails = new ReadProcessedDetails({});
            const indexRange = null;
            const dataEncoding = null;

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            historyReadResult.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
        });

        it("HRPD-1 [TODO] implement ReadAtTimeDetails", async () => {
            const historyReadDetails = new ReadAtTimeDetails({});
            const indexRange = null;
            const dataEncoding = null;

            const historyReadResult = await node.historyRead(context, historyReadDetails, indexRange, dataEncoding, {
                continuationPoint: null
            });

            historyReadResult.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
            should.not.exist(historyReadResult.continuationPoint, "expecting no continuation points in our case");
        });
    });
});
