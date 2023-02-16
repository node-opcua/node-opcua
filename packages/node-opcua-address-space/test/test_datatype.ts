import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import * as should from "should";

import { AddressSpace, SessionContext, UADataType } from "..";

import { getMiniAddressSpace } from "../testHelpers";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UADataype -  Attribute", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("namespace should have HasSubtype reference", () => {
        const node = addressSpace.findReferenceType("HasSubtype")!;
        node.browseName.toString().should.eql("HasSubtype");
    });

    it("UADataType#readAttribute", () => {
        const namespace = addressSpace.getOwnNamespace();

        const dataType = namespace.createDataType({
            browseName: "MyDataType",
            isAbstract: true,
            subtypeOf: "BaseDataType"
        });

        let value;

        value = dataType.readAttribute(context, AttributeIds.IsAbstract);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

        value = dataType.readAttribute(context, AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
    });

    describe("UADataType#isSupertypeOf", () => {
        let number_dt: UADataType;
        let double_dt: UADataType;
        let float_dt: UADataType;
        let integer_dt: UADataType;
        let int16_dt: UADataType;
        let uint32_dt: UADataType;
        let duration_dt: UADataType;
        let uinteger_dt: UADataType;
        let uint64_dt: UADataType;
        let int64_dt: UADataType;

        before(() => {
            // see table 120 OPCUA Spec part 5
            // BaseDataType   (i=24)
            //   +-->String   (i=12)
            //   +-->DateTime (i=13)
            //   +-->Guid     (i=14)
            //   +-->Number (i=26)
            //        +--> Double(i=11)
            //        +--> Float (i=10)
            //        +--> Integer (i=27)
            //              +--> SByte (i=2)
            //              +--> Int16 (i=4)
            //              +--> Int32 (i=6)
            //              +--> Int64 (i=8)
            //        +--> UInteger(i=28)
            //              +--> Byte   (i=3)
            //              +--> UInt16 (i=5)
            //              +--> UInt32 (i=7)
            //              +--> UInt64 (i=9)
            number_dt = addressSpace.findDataType("Number")!;

            double_dt = addressSpace.findDataType("Double")!;
            float_dt = addressSpace.findDataType("Float")!;
            integer_dt = addressSpace.findDataType("Integer")!;
            uinteger_dt = addressSpace.findDataType("UInteger")!;
            int16_dt = addressSpace.findDataType("Int16")!;
            uint32_dt = addressSpace.findDataType("UInt32")!;
            uint64_dt = addressSpace.findDataType("UInt64")!;
            int64_dt = addressSpace.findDataType("Int64")!;
            duration_dt = addressSpace.findDataType("Duration")!;

            (typeof number_dt).should.equal("object");
            (typeof float_dt).should.equal("object");
            (typeof double_dt).should.equal("object");
            (typeof integer_dt).should.equal("object");
            (typeof int16_dt).should.equal("object");
            (typeof uint32_dt).should.equal("object");
            (typeof duration_dt).should.equal("object");
        });

        it("Number should not be a sub type of Double", () => {
            number_dt.isSubtypeOf(double_dt).should.eql(false);
        });

        it("Double should be a sub type of Number", () => {
            number_dt.isSubtypeOf(double_dt).should.eql(false);
        });

        it("Int16 should be a sub type of Integer", () => {
            int16_dt.isSubtypeOf(integer_dt).should.eql(true);
        });
        it("Int16 should be a sub type of Number", () => {
            int16_dt.isSubtypeOf(number_dt).should.eql(true);
        });

        it("Int16 should not be a sub type of Float", () => {
            int16_dt.isSubtypeOf(float_dt).should.eql(false);
        });
        it("Int16 should be a sub type of Int16", () => {
            int16_dt.isSubtypeOf(int16_dt).should.eql(true);
        });
        it("Duration should be a sub type of Double", () => {
            duration_dt.isSubtypeOf(double_dt).should.eql(true);
        });

        it("Double should *not* be a sub type of Duration", () => {
            double_dt.isSubtypeOf(duration_dt).should.eql(false);
        });
        it("Integer should *not* be a sub type of UInt32", () => {
            integer_dt.isSubtypeOf(uint32_dt).should.eql(false);
        });
        it("UInteger should *not* be a sub type of Integer", () => {
            uinteger_dt.isSubtypeOf(integer_dt).should.eql(false);
        });

        it("UInt32 should be a super sub of UInteger", () => {
            uint32_dt.isSubtypeOf(uinteger_dt).should.eql(true);
        });
        it("UInt32 should *not* be a sub type of Integer", () => {
            uint32_dt.isSubtypeOf(integer_dt).should.eql(false);
        });
        it("UInt32 should be a super sub of UInteger", () => {
            uint32_dt.isSubtypeOf(uinteger_dt).should.eql(true);
        });

        it("UInt64 should be a super sub of UInteger", () => {
            uint64_dt.isSubtypeOf(uinteger_dt).should.eql(true);
        });
        it("int64 should be a super sub of Integer", () => {
            int64_dt.isSubtypeOf(integer_dt).should.eql(true);
        });

        it("UInt64 should *not* be a sub type of Integer", () => {
            uint64_dt.isSubtypeOf(integer_dt).should.eql(false);
        });
        it("int64 should *not* be a sub type of UInteger", () => {
            int64_dt.isSubtypeOf(uinteger_dt).should.eql(false);
        });
    });
});
