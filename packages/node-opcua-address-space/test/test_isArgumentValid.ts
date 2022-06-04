import * as path from "path";

import * as should from "should";

import { resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-types";
import { Variant, DataType, VariantArrayType } from "node-opcua-variant";

import { AddressSpace, Namespace } from "..";
import { generateAddressSpace } from "../nodeJS";
import { isArgumentValid } from "../source/helpers/argument_list";

const nodesetFilename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

interface TestCase {
    name: string;
    argument: Argument;
    valid: Variant[];
    invalid: Variant[];
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/104", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("private");
        await generateAddressSpace(addressSpace, nodesetFilename);
    });
    after(async () => {
        addressSpace.dispose();
    });

    const argumentOneOrMoreDimensions = new Argument({
        dataType: DataType.Double,
        name: "Blah",
        valueRank: 0
    });
    // Any (−2): The value can be a scalar or an array with any number of dimensions.

    const argumentAny = new Argument({
        dataType: DataType.Double,
        name: "Blah",
        valueRank: -2
    });
    // ScalarOrOneDimension (−3): The value can be a scalar or a one dimensional array.
    const argumentScalarOrOneDim = new Argument({
        dataType: DataType.Double,
        name: "Blah",
        valueRank: -3
    });

    const argumentScalarDouble = new Argument({
        dataType: DataType.Double,
        name: "Blah",
        valueRank: -1
    });
    const argumentMatrixDouble = new Argument({
        dataType: DataType.Double,
        arrayDimensions: [2, 2],
        name: "Blah",
        valueRank: 2
    });
    const argumentArrayDouble = new Argument({
        dataType: DataType.Double,
        name: "Blah",
        valueRank: 1
    });

    const methodInputArgumentsOneArrayOfAny: Argument = new Argument({
        valueRank: 1,
        arrayDimensions: [1],
        dataType: resolveNodeId("BaseDataType"),
        name: "someValue"
    });

    const nullVariant = new Variant({ dataType: DataType.Null });

    const scalarDouble = new Variant({ dataType: DataType.Double, value: 0 });
    const arrayDouble = new Variant({ dataType: DataType.Double, value: [0, 2, 3] });
    const matrixDouble = new Variant({
        dataType: DataType.Double,
        arrayType: VariantArrayType.Matrix,
        dimensions: [2, 2],
        value: [11, 12, 21, 22]
    });
    const scalarBoolean = new Variant({ dataType: DataType.Boolean, value: false });
    const arrayBoolean = new Variant({ dataType: DataType.Boolean, value: [true, false, true] });
    const matrixBoolean = new Variant({
        dataType: DataType.Boolean,
        arrayType: VariantArrayType.Matrix,
        dimensions: [2, 2],
        value: [true, false, true, true]
    });

    (
        [
            {
                name: "ScalarDouble",
                argument: argumentScalarDouble,
                valid: [scalarDouble],
                invalid: [arrayDouble, matrixDouble, scalarBoolean, arrayBoolean, matrixBoolean, nullVariant]
            },
            {
                name: "ArrayDouble",
                argument: argumentArrayDouble,
                valid: [arrayDouble, nullVariant],
                invalid: [scalarDouble, matrixDouble, scalarBoolean, arrayBoolean, matrixBoolean]
            },
            {
                name: "MatrixDouble",
                argument: argumentMatrixDouble,
                valid: [matrixDouble, nullVariant],
                invalid: [scalarDouble, arrayDouble, scalarBoolean, arrayBoolean, matrixBoolean]
            },
            {
                name: "OneOrMoreDimensions",
                argument: argumentOneOrMoreDimensions,
                valid: [matrixDouble, arrayDouble, nullVariant],
                invalid: [scalarDouble, scalarBoolean, arrayBoolean, matrixBoolean]
            },
            {
                name: "ScalarOrOneDim",
                argument: argumentScalarOrOneDim,
                valid: [scalarDouble, arrayDouble],
                invalid: [matrixDouble, scalarBoolean, arrayBoolean, matrixBoolean, nullVariant]
            },
            {
                name: "Any",
                argument: argumentAny,
                valid: [scalarDouble, arrayDouble, matrixDouble],
                invalid: [scalarBoolean, scalarBoolean, arrayBoolean, matrixBoolean, nullVariant]
            },
            {
                name: "OneArrayOfAny",
                argument: methodInputArgumentsOneArrayOfAny,
                valid: [arrayDouble, arrayBoolean, nullVariant],
                invalid: [scalarDouble, scalarBoolean, scalarBoolean, matrixDouble, matrixBoolean]
            }
        ] as TestCase[]
    ).forEach((useCase) => {
        describe(`testing ${useCase.name}`, () => {
            useCase.valid.forEach((validVariant) => {
                it(`should accept ${validVariant.toString()}`, () => {
                    const result = isArgumentValid(addressSpace, useCase.argument, validVariant);
                    should(result).eql(true);
                });
            });
            useCase.invalid.forEach((validVariant) => {
                it(`should not accept ${validVariant.toString()}`, () => {
                    const result = isArgumentValid(addressSpace, useCase.argument, validVariant);
                    should(result).eql(false);
                });
            });
        });
    });
});

/*
This Attribute indicates whether the Value Attribute of the Variable is an array and how many dimensions the array has.
It may have the following values:
n > 1: the Value is an array with the specified number of dimensions.
OneDimension (1): The value is an array with one dimension.
OneOrMoreDimensions (0): The value is an array with one or more dimensions.
Scalar (−1): The value is not an array.
Any (−2): The value can be a scalar or an array with any number of dimensions.
ScalarOrOneDimension (−3): The value can be a scalar or a one dimensional array.
All DataTypes are considered to be scalar, even if they have array-like semantics like ByteString and String.
*/
