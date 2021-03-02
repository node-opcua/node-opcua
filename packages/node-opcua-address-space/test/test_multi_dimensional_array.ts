import "should";
import { DataValue } from "node-opcua-data-value";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { AddressSpace, SessionContext, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";

describe("Multi-Dimensional Array", () => {
    let addressSpace: AddressSpace;
    let matrixVariable: UAVariable;
    let arrayVariable: UAVariable;
    const defaultMatrixValue = new Variant({
        dataType: DataType.Double,
        arrayType: VariantArrayType.Matrix,
        dimensions: [4, 5],
        // prettier-ignore
        value: new Float64Array([
             11, 12, 13, 14, 15,
             21, 22, 23, 24, 25,
             31, 32, 33, 34, 35,
             41, 42, 43, 44, 45,
        ])
    });
    const defaultArrayValue = new Variant({
        dataType: DataType.Double,
        arrayType: VariantArrayType.Array,
        // prettier-ignore
        value: new Float64Array([
             11, 12, 13, 14, 15,
        ])
    });

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        const namespace1 = addressSpace.getOwnNamespace();

        matrixVariable = namespace1.addVariable({
            browseName: "MatrixVariable",
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: defaultMatrixValue.dimensions,
            value: defaultMatrixValue
        });
        matrixVariable.arrayDimensions!.should.eql([4, 5]);
        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);

        arrayVariable = namespace1.addVariable({
            browseName: "ArrayVariable",
            dataType: "Double",
            valueRank: 1,
            value: defaultArrayValue
        });
    });
    after(() => {
        addressSpace.dispose();
    });
    beforeEach(async () => {
        await matrixVariable.writeValue(SessionContext.defaultContext, new DataValue({ value: defaultMatrixValue }));
        await arrayVariable.writeValue(SessionContext.defaultContext, new DataValue({ value: defaultArrayValue }));
    });
    it("MDA-1 should write a single element in a  matrix", async () => {
        const statusCode = await matrixVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [1, 1],
                    value: new Float64Array([8888])
                }
            }),
            new NumericRange([2, 2], [3, 3])
        );
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
                 11, 12, 13, 14, 15,
                 21, 22, 23, 24, 25,
                 31, 32, 33, 8888, 35,
                 41, 42, 43, 44, 45,
            ])
        );
    });
    it("MDA-2 should write a sub-matrix element in a  matrix", async () => {
        const statusCode = await matrixVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [2, 3],
                    // prettier-ignore
                    value: new Float64Array([
                        8888, 8889, 8890,
                        7777, 7778, 7779
                    ])
                }
            }),
            "1:2,2:4"
        );
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
                 11, 12, 13, 14, 15,
                 21, 22, 8888, 8889, 8890,
                 31, 32, 7777, 7778, 7779,
                 41, 42, 43, 44, 45,
            ])
        );
    });

    it("MDA-3 write should return an error if the sub-matrix element is written outside the boundary", async () => {
        const statusCode = await matrixVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [2, 3],
                    // prettier-ignore
                    value: new Float64Array([
                        8888, 8889, 8890,
                        7777, 7778, 7779
                    ])
                }
            }),
            "3:4,2:4" // Wrong rows!
        );
        statusCode.should.eql(StatusCodes.BadTypeMismatch);

        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
             11, 12, 13, 14, 15,
             21, 22, 23, 24, 25,
             31, 32, 33, 34, 35,
             41, 42, 43, 44, 45,
          ])
        );
    });
    it("MDA-4 write should return an OK if the sub-matrix element is written inside the boundary", async () => {
        const statusCode = await matrixVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [2, 3],
                    // prettier-ignore
                    value: new Float64Array([
                        8888, 8889, 8890,
                        7777, 7778, 7779
                    ])
                }
            }),
            "2:3,2:4" // Correct rows! touching the sides
        );
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
             11, 12, 13, 14, 15,
             21, 22, 23, 24, 25,
             31, 32, 8888, 8889, 8890,
             41, 42, 7777, 7778, 7779,
          ])
        );
    });
    it("MDA-5 write should return BadTypeMismatch on an attempt to write a sub array on a matrix", async () => {
        const statusCode = await matrixVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Array,
                    // prettier-ignore
                    value: new Float64Array([
                        8888, 8889
                    ])
                }
            }),
            "1:2" // Wrong rows!
        );

        const dataValueCheck = matrixVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValueCheck.value.dimensions!.should.eql([4, 5]);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
             11, 12, 13, 14, 15,
             21, 22, 23, 24, 25,
             31, 32, 33, 34, 35,
             41, 42, 43, 44, 45,
          ])
        );
        statusCode.should.eql(StatusCodes.BadTypeMismatch);
    });
    it("MDA-6 write should return BadTypeMismatch on an attempt to write a sub matrix  on a array", async () => {
        const statusCode = await arrayVariable.writeValue(
            SessionContext.defaultContext,
            new DataValue({
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [2, 3],
                    // prettier-ignore
                    value: new Float64Array([
                        8888, 8889, 8890,
                        7777, 7778, 7779
                    ])
                }
            }),
            "0:1,0:2"
        );

        const dataValueCheck = arrayVariable.readValue();
        dataValueCheck.value.arrayType.should.eql(VariantArrayType.Array);
        dataValueCheck.value.value.should.eql(
            // prettier-ignore
            new Float64Array([
             11, 12, 13, 14, 15,
          ])
        );
        statusCode.should.eql(StatusCodes.BadTypeMismatch);
    });
});
