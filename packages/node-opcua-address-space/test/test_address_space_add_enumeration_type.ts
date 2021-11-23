import { BrowseDirection } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { BrowseDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import * as should from "should";

import { getMiniAddressSpace } from "../testHelpers";

import { AddressSpace, BaseNode, Namespace, SessionContext } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace : testing add enumeration type", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });

    after(() => {
        addressSpace.dispose();
    });

    it("should add a new Enumeration type into an address space - Form 1", () => {
        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumType2",
            enumeration: ["RUNNING", "BLOCKED", "IDLE", "UNDER MAINTENANCE"]
        });

        myEnumType.browseName.toString().should.eql("1:MyEnumType2");

        const enumerationType = addressSpace.findDataType("Enumeration")!;

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        const browseDescription = new BrowseDescription({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: null,
            resultMask: 0x3f
        });
        const r = enumerationType.browseNode(browseDescription);
        const names = r.map((x: any) => x.browseName.toString());

        names.filter((x: string) => x === "1:MyEnumType2").length.should.eql(1, "MyEnumType2 should be find in enum");

        // now instantiate a variable that have this type.
        const e = namespace.addVariable({
            browseName: "RunningState",
            dataType: myEnumType,
            propertyOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });

        e.setValueFromSource({ dataType: DataType.Int32, value: 1 });

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({ name: "BLOCKED", value: 1 });

        e.setValueFromSource({ dataType: DataType.Int32, value: 2 });

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({ name: "IDLE", value: 2 });

        // now use writeEnumValue helper
        e.writeEnumValue("BLOCKED");
        e.readEnumValue().should.eql({ name: "BLOCKED", value: 1 });

        e.writeEnumValue("IDLE");
        e.readEnumValue().should.eql({ name: "IDLE", value: 2 });

        e.writeEnumValue(1);
        e.readEnumValue().should.eql({ name: "BLOCKED", value: 1 });

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({ name: "IDLE", value: 2 });

        should(() => {
            e.writeEnumValue(-2);
        }).throwError();

        should(() => {
            e.writeEnumValue(10);
        }).throwError();

        should(() => {
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(() => {
            (e as any).writeEnumValue({ value: "invalid type" });
        }).throwError();
    });

    it("should add a new Enumeration type into an address space - Form 2", () => {
        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumType3",
            enumeration: [
                { displayName: "VALUE01", value: 0x01 },
                { displayName: "VALUE02", value: 0x02 },
                { displayName: "VALUE04", value: 0x04 },
                { displayName: "VALUE08", value: 0x08 }
            ]
        });

        myEnumType.browseName.toString().should.eql("1:MyEnumType3");

        const enumerationType = addressSpace.findDataType("Enumeration")!;

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        const browseDescription = new BrowseDescription({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: null,
            resultMask: 0x3f
        });
        const r = enumerationType.browseNode(browseDescription);
        const names = r.map((x: any) => x.browseName.toString());

        names.filter((x: string) => x === "1:MyEnumType3").length.should.eql(1, "MyEnumType3 should be find in enum");

        // now instantiate a variable that have this type.
        const e = namespace.addVariable({
            browseName: "RunningState",
            dataType: myEnumType,
            propertyOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });

        e.setValueFromSource({ dataType: DataType.Int32, value: 1 });

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({ name: "VALUE01", value: 1 });

        e.setValueFromSource({ dataType: DataType.Int32, value: 2 });

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({ name: "VALUE02", value: 2 });

        // now use writeEnumValue helper

        e.writeEnumValue("VALUE04");
        e.readEnumValue().should.eql({ name: "VALUE04", value: 4 });

        e.writeEnumValue("VALUE08");
        e.readEnumValue().should.eql({ name: "VALUE08", value: 8 });

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({ name: "VALUE02", value: 2 });

        e.writeEnumValue(4);
        e.readEnumValue().should.eql({ name: "VALUE04", value: 4 });

        should(() => {
            e.writeEnumValue(-2);
        }).throwError();

        should(() => {
            e.writeEnumValue(10);
        }).throwError();

        should(() => {
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(() => {
            (e as any).writeEnumValue({ value: "invalid type" });
        }).throwError();
    });

    it("should add a writable new Enumeration type into an address space  #552 ", async () => {
        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumType4",
            enumeration: ["RUNNING", "BLOCKED", "IDLE", "UNDER MAINTENANCE"]
        });

        // now instantiate a variable that have this type.
        const e = namespace.addVariable({
            browseName: "RunningState",
            dataType: myEnumType,
            propertyOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });

        // simulate a write
        const statusCode = await e.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Int32,
                    value: 2
                }
            })
        );
        should(statusCode).eql(StatusCodes.Good);

        e.readEnumValue().should.eql({ name: "IDLE", value: 2 });
    });
});
