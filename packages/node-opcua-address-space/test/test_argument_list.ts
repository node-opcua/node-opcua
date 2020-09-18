import * as should from "should";
import * as _ from "underscore";

import { DataType, VariantArrayType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import { BinaryStream } from "node-opcua-binary-stream";
import {
    binaryStoreSize_ArgumentList,
    convertJavaScriptToVariant,
    decode_ArgumentList,
    encode_ArgumentList,
    verifyArguments_ArgumentList,
    AddressSpace
} from "..";
import { generateAddressSpace } from "../nodeJS";

import { nodesets } from "node-opcua-nodesets";
import { Argument, ArgumentOptions } from "node-opcua-types";
import { resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes, StatusCode } from "node-opcua-status-code";

function extractValues(arrayVariant: Variant[]) {
    return arrayVariant.map(_.property("value"));
}

describe("convertJavaScriptToVariant", () => {
    it("should convertJavaScriptToVariant", () => {
        const definition = [{ dataType: DataType.UInt32 }];
        const args = [100];

        const args_as_variant = convertJavaScriptToVariant(definition, args);

        args_as_variant.length.should.eql(1);
        args_as_variant[0].should.eql(new Variant({ dataType: DataType.UInt32, value: 100 }));

        extractValues(args_as_variant).should.eql([100]);
    });
});

describe("testing ArgumentList special encode/decode process", () => {
    it("should encode/decode an ArgumentList (scalar)", () => {
        const definition = [{ dataType: DataType.UInt32 }];
        const args = [100];

        const size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(4, " the size of a single UInt32");

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded[0].should.eql(100);
    });

    it("should encode/decode an ArgumentList (array)", () => {
        const definition = [
            {
                dataType: DataType.UInt32,
                valueRank: 1
            }
        ];
        const args = [[100, 200, 300]];

        const size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(3 * 4 + 4, " the size of a 3 x UInt32  + length");

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded.length.should.eql(1);
        args_reloaded[0].length.should.eql(3);
        args_reloaded[0][0].should.eql(100);
        args_reloaded[0][1].should.eql(200);
        args_reloaded[0][2].should.eql(300);
    });

    it("should encode/decode an ArgumentList with a complex definition", () => {
        const definition = [
            { dataType: DataType.UInt32, name: "someValue" },
            { dataType: DataType.UInt32, valueRank: 1, name: "someValueArray" },
            { dataType: DataType.String, name: "someText" }
        ];

        const args = [10, [15, 20], "Hello"];

        const size = binaryStoreSize_ArgumentList(definition, args);

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        // here the base dataType is created with its definition before decode is called
        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);
        args_reloaded[0].should.equal(10);
        args_reloaded[1][0].should.equal(15);
        args_reloaded[1][1].should.equal(20);
        args_reloaded[2].should.equal("Hello");
    });
});

describe("verifyArguments_ArgumentList", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = nodesets.standard_nodeset_file;
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.registerNamespace("ServerNamespaceURI");
    });
    after(() => {
        addressSpace.dispose();
    });

    const methodInputArgumentsOneUInt32: Argument[] = [
        new Argument({
            arrayDimensions: null,
            dataType: resolveNodeId(DataType.UInt32),
            description: "Some arguments",
            name: "someValue",
            valueRank: -1
        })
    ];

    it("verifyArguments_ArgumentList - One UInt32 - Good", () => {
        const args = [new Variant({ dataType: DataType.UInt32, value: 1 })];
        const result = verifyArguments_ArgumentList(addressSpace, methodInputArgumentsOneUInt32, args);

        // tslint:disable: no-console
        console.log("inputArgumentResults[0]", result.inputArgumentResults![0].toString());
        console.log("statusCode             ", result.statusCode.toString());

        result.should.eql({
            inputArgumentResults: [StatusCodes.Good],
            statusCode: StatusCodes.Good
        });
    });
    it("verifyArguments_ArgumentList - One UInt32 - TypeMismatch", () => {
        const argsBad = [new Variant({ dataType: DataType.String, value: "Bad" })];
        const result = verifyArguments_ArgumentList(addressSpace, methodInputArgumentsOneUInt32, argsBad);
        // tslint:disable: no-console
        console.log("inputArgumentResults[0]", result.inputArgumentResults![0].toString());
        console.log("statusCode             ", result.statusCode.toString());
        result.should.eql({
            inputArgumentResults: [StatusCodes.BadTypeMismatch],
            statusCode: StatusCodes.BadInvalidArgument
        });
    });

    const methodInputArgumentsOneArrayOfAny: Argument[] = [
        new Argument({
            arrayDimensions: [1],
            dataType: resolveNodeId("BaseDataType"),
            description: "Some arguments",
            name: "someValue",
            valueRank: 1
        })
    ];
    it("methodInputArgumentsOneArrayOfAny - Good", () => {
        const argsGood1 = [
            new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.String,
                value: ["Good", "Good"]
            })
        ];
        const result = verifyArguments_ArgumentList(addressSpace, methodInputArgumentsOneArrayOfAny, argsGood1);
        // tslint:disable: no-console
        console.log("inputArgumentResults[0]", result.inputArgumentResults![0].toString());
        console.log("statusCode             ", result.statusCode.toString());
        result.should.eql({
            inputArgumentResults: [StatusCodes.Good],
            statusCode: StatusCodes.Good
        });
    });

    it("methodInputArgumentsOneArrayOfAny - TypeMismatch", () => {
        const argsBad = [
            new Variant({
                arrayType: VariantArrayType.Scalar,
                dataType: DataType.String,
                value: "Good"
            })
        ];
        const result = verifyArguments_ArgumentList(addressSpace, methodInputArgumentsOneArrayOfAny, argsBad);
        // tslint:disable: no-console
        console.log("inputArgumentResults[0]", result.inputArgumentResults![0].toString());
        console.log("statusCode             ", result.statusCode.toString());
        result.should.eql({
            inputArgumentResults: [StatusCodes.BadTypeMismatch],
            statusCode: StatusCodes.BadInvalidArgument
        });
    });

    it("methodInputArgumentsOneArrayOfAny - SpecialCase", () => {
        // Null variant shall be consider as a empty array !!!
        const argsBad = [
            new Variant({
                dataType: DataType.Null
            })
        ];
        const result = verifyArguments_ArgumentList(addressSpace, methodInputArgumentsOneArrayOfAny, argsBad);
        // tslint:disable: no-console
        console.log("inputArgumentResults[0]", result.inputArgumentResults![0].toString());
        console.log("statusCode             ", result.statusCode.toString());
        result.should.eql({
            inputArgumentResults: [StatusCodes.Good],
            statusCode: StatusCodes.Good
        });
    });
});
