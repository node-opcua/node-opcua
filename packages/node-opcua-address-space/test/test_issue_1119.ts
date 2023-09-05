import "should";
import { nodesets } from "node-opcua-nodesets";
import { resolveNodeId } from "node-opcua-nodeid";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { AttributeIds } from "node-opcua-basic-types";
import { HistoryData, HistoryReadResult, ReadRawModifiedDetails } from "node-opcua-types";
import { DataValue } from "node-opcua-data-value";

import { generateAddressSpace } from "../distNodeJS";
import { ISessionBase, PseudoSession, SessionContext, UAVariable } from "..";
import { AddressSpace } from "..";

describe("historization and status code Bad #1119", function () {
    this.timeout(Math.max(300000, this.timeout()));

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("OwnNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    let counter = 0;

    const adapt = (historyReadResult: HistoryReadResult) => {
        return (historyReadResult.historyData as HistoryData).dataValues!.map((dataValue) => ({
            value: dataValue.value.value,
            statusCode: dataValue.statusCode,
            toString() {
                return `${this.value} ${(this.statusCode as StatusCode).name.toString()}`;
            }
        }));
    };
    async function test(valueBinding: any, instrumentRange?: { low: number; high: number }) {
        const namespace = addressSpace.getOwnNamespace();

        const myHistoricalSetPointVar = instrumentRange
            ? namespace.addAnalogDataItem({
                  browseName: "MyHistoricalSetPintVar" + counter++,
                  organizedBy: resolveNodeId("ObjectsFolder"),
                  dataType: DataType.Double,
                  userAccessLevel: "CurrentRead | CurrentWrite",
                  minimumSamplingInterval: 100,
                  instrumentRange,
                  engineeringUnitsRange: instrumentRange,
                  value: valueBinding,
                  acceptValueOutOfRange: true
              })
            : namespace.addVariable({
                  browseName: "MyHistoricalSetPintVar" + counter++,
                  organizedBy: resolveNodeId("ObjectsFolder"),
                  dataType: DataType.Double,
                  userAccessLevel: "CurrentRead | CurrentWrite",
                  minimumSamplingInterval: 100,
                  value: valueBinding,
              });


        addressSpace?.installHistoricalDataNode(myHistoricalSetPointVar, {
            maxOnlineValues: 500
        });

        const nodeId = myHistoricalSetPointVar.nodeId;
        const session = new PseudoSession(addressSpace);

        const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const write = async (value: number, statusCode: StatusCode) => {
            await pause(100);
            try {
                const retStatusCode = await session.write({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        value: { dataType: DataType.Double, value },
                        statusCode
                    }
                });
                console.log(retStatusCode.toString(), value, statusCode.description.toString());
                return retStatusCode;
            } catch (err) {
                console.log("write failed ", (err as any).message);
                return StatusCodes.BadInternalError;
            }
        };

        await write(1, StatusCodes.Good);
        await write(100, StatusCodes.Good);
        await write(1000, StatusCodes.Good);
        await write(10, StatusCodes.GoodClamped);
        
        // ensure all async actions are completed
        // is server side
        await pause(1000);
          
        const defaultContext = new SessionContext({
            session: session as unknown as ISessionBase
        });
        const r = await myHistoricalSetPointVar.historyRead(
            defaultContext,
            new ReadRawModifiedDetails({
                isReadModified: false,
                startTime: new Date(1970, 1, 1),
                endTime: new Date(),
                returnBounds: true
            }),
            null,
            null,
            {
                continuationPoint: null
            }
        );
        console.log(adapt(r).toString());
        return adapt(r).map((x) => x.toString());
    }
    it("should create a historical node with a status code  - form 1", async () => {
        let setPoint = 50;
        const result = await test({
            get: function (): Variant {
                return new Variant({
                    value: setPoint,
                    dataType: DataType.Double
                });
            },
            set: function (this: UAVariable, value: Variant) {
                // Check in the backend, if value is in range
                if (value.value <= 100 && value.value > 0) {
                    setPoint = value.value;
                    return StatusCodes.Good;
                } else {
                    // SetPoint not valid!
                    return StatusCodes.BadOutOfRange;
                }
            }
        });
        result.should.eql(["50 Good", "1 Good", "100 Good", "1000 BadOutOfRange", "10 GoodClamped"]);
    });

    it("should create a historical node with a status code - form 2", async () => {
        let setPoint = 50;
        const result = await test({
            get: function (): Variant {
                return new Variant({
                    value: setPoint,
                    dataType: DataType.Double
                });
            },
            set: function (this: UAVariable, value: Variant) {
                // Check in the backend, if value is in range
                if (value.value <= 100 && value.value > 0) {
                    setPoint = value.value;
                    return StatusCodes.Good;
                } else {
                    // SetPoint not valid!
                    throw new Error("Bad out of Range");
                }
            }
        });
        result.should.eql([
            "50 Good",
            "1 Good",
            "100 Good",
            // "1000 BadOutOfRange",
            "10 GoodClamped"
        ]);
    });

    it("should create a historical node with a status code - form 3", async () => {
        let _value: DataValue = new DataValue({ value: { dataType: DataType.Double, value: 50 } });
        const result = await test({
            timestamped_get: function (): DataValue {
                return _value;
            },
            timestamped_set: async function (this: UAVariable, value: DataValue) {
                // Check in the backend, if value is in range
                if (value.value.value > 100 || value.value.value <= 0) {
                    value.statusCode = StatusCodes.BadOutOfRange;
                }
                _value = value;
                return StatusCodes.Good;
            }
        });
        result.should.eql([
            //  "50 Good",
            "1 Good",
            "100 Good",
            "1000 BadOutOfRange",
            "10 GoodClamped"
        ]);
    });

    it("should create a historical node with a status code - form 4", async () => {
        const setPoint = 50;
        const result = await test({ dataType: DataType.Double, value: setPoint });
        result.should.eql(["50 Good", "1 Good", "100 Good", "1000 Good", "10 GoodClamped"]);
    });

    it("should create a historical node with a status code - form 5", async () => {
        const setPoint = 50;
        const result = await test({ dataType: DataType.Double, value: setPoint }, { low: 0, high: 100 });
        result.should.eql(["50 Good", "1 Good", "100 Good", "1000 BadOutOfRange", "10 GoodClamped"]);
    });
});
