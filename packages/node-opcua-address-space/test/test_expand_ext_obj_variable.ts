/* eslint-disable max-statements */
/* eslint-disable no-inner-declarations */
import * as should from "should";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataTypeIds } from "node-opcua-constants";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { ThreeDCartesianCoordinates } from "node-opcua-types";
import { StatusCodes } from "node-opcua-status-code";
import { AttributeIds, DateTime } from "node-opcua-basic-types";
import { makeAccessLevelFlag } from "node-opcua-data-model";
import { ExtensionObject } from "node-opcua-extension-object";

import { AddressSpace, BaseNode, INamespace, PseudoSession, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

async function simulateExternalWriteEx(node: BaseNode, value: ExtensionObject, sourceTimestamp: DateTime) {
    const addressSpace = node.addressSpace;
    const session = new PseudoSession(addressSpace);
    const statusCode1 = await session.write({
        nodeId: node.nodeId,
        value: { value: { dataType: DataType.ExtensionObject, value }, sourceTimestamp },
        attributeId: AttributeIds.Value
    });

    statusCode1.should.eql(StatusCodes.Good);

    const checkValue = (node! as UAVariable).readValue();
    checkValue.value.dataType.should.eql(DataType.ExtensionObject);
    checkValue.value.value.toString().should.eql(value.toString());
}


async function simulateExternalWrite(node: BaseNode, value: number, sourceTimestamp: DateTime) {
    const addressSpace = node.addressSpace;
    const session = new PseudoSession(addressSpace);
    const statusCode1 = await session.write({
        nodeId: node.nodeId,
        value: { value: { dataType: DataType.Double, value }, sourceTimestamp },
        attributeId: AttributeIds.Value
    });

    statusCode1.should.eql(StatusCodes.Good);

    const checkValue = (node! as UAVariable).readValue();
    checkValue.value.dataType.should.eql(DataType.Double);
    checkValue.value.value.should.eql(value);
}


// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Extending extension object variables", function () {

    this.timeout(Math.max(this.timeout(), 500000));
    let addressSpace: AddressSpace;
    let namespace: INamespace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("urn:private");
    });
    after(() => {
        addressSpace.shutdown();
        addressSpace.dispose();
    });
    const extensionObjectDataType = resolveNodeId(DataTypeIds.ThreeDCartesianCoordinates);
    const p1 = new ThreeDCartesianCoordinates({ x: 1, y: 2, z: 3 });
    const p2 = new ThreeDCartesianCoordinates({ x: 4, y: 5, z: 6 });
    const p3 = new ThreeDCartesianCoordinates({ x: 7, y: 8, z: 9 });
    const p4 = new ThreeDCartesianCoordinates({ x: 10, y: 11, z: 12 });

    function addVariable_bindExtensionObject() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V1",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite")
        });
        uaVariable.bindExtensionObject(p1.clone(), { createMissingProp: true });
        return uaVariable;

    }
    function addVariable_setValueFromSource_installExtensionObjectVariable() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V1",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite")
        });

        uaVariable.setValueFromSource({
            value: p1.clone(),
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.ExtensionObject
        }, StatusCodes.Good, new Date(Date.UTC(2022, 0, 1, 0, 0, 0)));
        uaVariable.readValue().sourceTimestamp?.toISOString().should.eql("2022-01-01T00:00:00.000Z");

        uaVariable.installExtensionObjectVariables();
        return uaVariable;
    }
    function addVariable_with_init_installExtensionObjectVariable() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V1",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            value: { dataType: DataType.ExtensionObject, value: p1.clone() }
        });
        uaVariable.installExtensionObjectVariables();
        return uaVariable;
    }

    function addVariable_setValueFromSource_installExtensionObjectVariable_array() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            nodeId: "s=\"SomeData1\"",
            browseName: "V2a",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 1,
        });

        uaVariable.setValueFromSource({
            value: [p1.clone(), p2.clone()],
            arrayType: VariantArrayType.Array,
            dataType: DataType.ExtensionObject
        }, StatusCodes.Good, new Date(Date.UTC(2022, 0, 1)));

        uaVariable.installExtensionObjectVariables();
        return uaVariable;
    }
    function addVariable_bindExtensionObject_array() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            nodeId: "s=\"SomeData2\"",
            browseName: "V2b",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 1,
        });

        uaVariable.bindExtensionObject([p1.clone(), p2.clone()], { createMissingProp: true });
        return uaVariable;
    }

    {

        [
            addVariable_bindExtensionObject,
            addVariable_setValueFromSource_installExtensionObjectVariable,
            addVariable_with_init_installExtensionObjectVariable
        ].forEach((build, index) => {

            it(`D0-${index} ${build.name} - should expand a scalar extension object variable`, async () => {
                const uaVariable = build();

                // the inner propertis of the extension should now be exposed
                const uaX = uaVariable.getComponentByName("X")! as UAVariable;
                const uaY = uaVariable.getComponentByName("Y")! as UAVariable;
                const uaZ = uaVariable.getComponentByName("Z")! as UAVariable;

                uaX.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");
                uaY.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");
                uaZ.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");

                should.exist(uaX);
                should.exist(uaY);
                should.exist(uaZ);

                const verify = ({ x, y, z }: { x: number, y: number, z: number }) => {
                    const dataValue = uaVariable.readValue();
                    dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue.value.value.x.should.eql(x);
                    dataValue.value.value.y.should.eql(y);
                    dataValue.value.value.z.should.eql(z);

                    const xDataValue = uaX.readValue();
                    xDataValue.value.dataType.should.eql(DataType.Double);
                    xDataValue.value.value.should.eql(x);

                    const yDataValue = uaY.readValue();
                    yDataValue.value.dataType.should.eql(DataType.Double);
                    yDataValue.value.value.should.eql(y);

                    const zDataValue = uaZ.readValue();
                    zDataValue.value.dataType.should.eql(DataType.Double);
                    zDataValue.value.value.should.eql(z);

                    //s dataValue.sourceTimestamp?.toISOString().should.eql("2023-01-02T06:47:55.065Z");
                    xDataValue.sourceTimestamp?.getTime().should.lessThanOrEqual(dataValue.sourceTimestamp!.getTime());
                    yDataValue.sourceTimestamp?.getTime().should.lessThanOrEqual(dataValue.sourceTimestamp!.getTime());
                    zDataValue.sourceTimestamp?.getTime().should.lessThanOrEqual(dataValue.sourceTimestamp!.getTime());

                }
                verify({ x: 1, y: 2, z: 3 });
                // 
                //
                await simulateExternalWrite(uaZ, 33, new Date(Date.UTC(2022, 0, 2, 0, 0, 0)));
                verify({ x: 1, y: 2, z: 33 });
                // 

                await simulateExternalWriteEx(uaVariable, p2.clone(), new Date(Date.UTC(2022, 0, 3, 0, 0, 0)));

                verify({ x: 4, y: 5, z: 6 });

            });
        });
    }

    {


        [
            addVariable_setValueFromSource_installExtensionObjectVariable_array,
            addVariable_bindExtensionObject_array
        ].forEach((build, index) => {

            // eslint-disable-next-line max-statements
            it(`D1-${index} ${build.name}- should expand a array extension object variable`, async () => {

                const uaVariable = build();

                const el0 = uaVariable.getComponentByName("0") as UAVariable;
                sameNodeId(el0.dataType, uaVariable.dataType).should.eql(true);
                el0?.nodeId.toString().should.eql(uaVariable.nodeId?.toString() + "[0]");

                const el1 = uaVariable.getComponentByName("1") as UAVariable;
                sameNodeId(el1.dataType, uaVariable.dataType).should.eql(true);
                el1.nodeId.toString().should.eql(uaVariable.nodeId?.toString() + "[1]");

                //xx console.log(v.toString());
                should.exist(el0);
                should.exist(el1);

                const dataValue = uaVariable.readValue();
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue.value.arrayType.should.eql(VariantArrayType.Array);
                dataValue.value.value.length.should.eql(2);
                dataValue.value.value[0].x.should.eql(1);
                dataValue.value.value[0].y.should.eql(2);
                dataValue.value.value[0].z.should.eql(3);
                dataValue.value.value[1].x.should.eql(4);
                dataValue.value.value[1].y.should.eql(5);
                dataValue.value.value[1].z.should.eql(6);

                {
                    if (!el0) return;
                    const x = el0.getComponentByName("X");
                    const y = el0.getComponentByName("Y");
                    const z = el0.getComponentByName("Z");

                    should.exist(x);
                    should.exist(y);
                    should.exist(z);

                }
                {
                    if (!el1) return;
                    const x = el1.getComponentByName("X");
                    const y = el1.getComponentByName("Y");
                    const z = el1.getComponentByName("Z");

                    should.exist(x);
                    should.exist(y);
                    should.exist(z);

                }
                const verify = (array: { x: number, y: number, z: number }[]) => {

                    const dataValue = uaVariable.readValue();
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue.value.arrayType.should.eql(VariantArrayType.Array);

                    const dataValue00 = el0.readValue();
                    dataValue00.statusCode.should.eql(StatusCodes.Good);
                    dataValue00.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue00.value.arrayType.should.eql(VariantArrayType.Scalar);
                    dataValue00.value.value.x.should.eql(array[0].x);
                    dataValue00.value.value.y.should.eql(array[0].y);
                    dataValue00.value.value.z.should.eql(array[0].z);

                    const dataValue01 = el1.readValue();
                    dataValue01.statusCode.should.eql(StatusCodes.Good);
                    dataValue01.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue01.value.arrayType.should.eql(VariantArrayType.Scalar);
                    dataValue01.value.value.x.should.eql(array[1].x);
                    dataValue01.value.value.y.should.eql(array[1].y);
                    dataValue01.value.value.z.should.eql(array[1].z);

                    const extGlobal = dataValue.value.value as any[];

                    extGlobal[0].x.should.eql(array[0].x);
                    extGlobal[0].y.should.eql(array[0].y);
                    extGlobal[0].z.should.eql(array[0].z);

                    extGlobal[1].x.should.eql(array[1].x);
                    extGlobal[1].y.should.eql(array[1].y);
                    extGlobal[1].z.should.eql(array[1].z);


                    const el0x = el0.getComponentByName("X")! as UAVariable;
                    const el0y = el0.getComponentByName("Y")! as UAVariable;
                    const el0z = el0.getComponentByName("Z")! as UAVariable;

                    const el1x = el1.getComponentByName("X")! as UAVariable;
                    const el1y = el1.getComponentByName("Y")! as UAVariable;
                    const el1z = el1.getComponentByName("Z")! as UAVariable;

                    const el0xDataValue = el0x.readValue();
                    el0xDataValue.statusCode.should.eql(StatusCodes.Good);
                    el0xDataValue.value.dataType.should.eql(DataType.Double);
                    el0xDataValue.value.value.should.eql(array[0].x);

                    const el0yDataValue = el0y.readValue();
                    el0yDataValue.statusCode.should.eql(StatusCodes.Good);
                    el0yDataValue.value.dataType.should.eql(DataType.Double);
                    el0yDataValue.value.value.should.eql(array[0].y);

                    const el0zDataValue = el0z.readValue();
                    el0zDataValue.statusCode.should.eql(StatusCodes.Good);
                    el0zDataValue.value.dataType.should.eql(DataType.Double);
                    el0zDataValue.value.value.should.eql(array[0].z);


                    const el1xDataValue = el1x.readValue();
                    el1xDataValue.statusCode.should.eql(StatusCodes.Good);
                    el1xDataValue.value.dataType.should.eql(DataType.Double);
                    el1xDataValue.value.value.should.eql(array[1].x);

                    const el1yDataValue = el1y.readValue();
                    el1yDataValue.statusCode.should.eql(StatusCodes.Good);
                    el1yDataValue.value.dataType.should.eql(DataType.Double);
                    el1yDataValue.value.value.should.eql(array[1].y);

                    const el1zDataValue = el1z.readValue();
                    el1zDataValue.statusCode.should.eql(StatusCodes.Good);
                    el1zDataValue.value.dataType.should.eql(DataType.Double);
                    el1zDataValue.value.value.should.eql(array[1].z);

                }
                verify([{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }]);


                // now write  a leaf property and verify that the value cascade upward
                const x = el1.getComponentByName("X")!;


                await simulateExternalWrite(x, 44, new Date(Date.UTC(2022, 0, 2)));
                verify([{ x: 1, y: 2, z: 3 }, { x: 44, y: 5, z: 6 }]);

                await simulateExternalWriteEx(el1, p3.clone(), new Date(Date.UTC(2022, 0, 3)));
                verify([{ x: 1, y: 2, z: 3 }, { x: 7, y: 8, z: 9 }]);

                await simulateExternalWrite(x, 22, new Date(Date.UTC(2022, 0, 4)));
                verify([{ x: 1, y: 2, z: 3 }, { x: 22, y: 8, z: 9 }]);


            });
        });
    }

    function addVariable_setValueFromSource_installExtensionObjectVariable_matrix() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V2-1",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 2,
            arrayDimensions: [2, 3]
        });
        uaVariable.setValueFromSource(new Variant({
            value: [p1.clone(), p2.clone(), p3.clone(), p1.clone(), p2.clone(), p3.clone()],
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            dataType: DataType.ExtensionObject
        }));

        uaVariable.installExtensionObjectVariables();
        return uaVariable;
    }
    function addVariable_bindExtensionObject_matrix() {
        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V2-2",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 2,
            arrayDimensions: [2, 3]
        });
        uaVariable.bindExtensionObjectArray([
            p1.clone(), p2.clone(), p3.clone(), p1.clone(), p2.clone(), p3.clone()
        ], { createMissingProp: true });
        return uaVariable;
    }

    [
        addVariable_setValueFromSource_installExtensionObjectVariable_matrix,
        addVariable_bindExtensionObject_matrix
    ].forEach((build, index) => {

        it(`D2-${index} ${build.name} - should expand a matrix extension object variable`, async () => {

            const uaVariable = build();

            // console.log(uaVariable.toString());

            const el00 = uaVariable.getComponentByName("0,0") as UAVariable;
            const el01 = uaVariable.getComponentByName("0,1") as UAVariable;
            const el02 = uaVariable.getComponentByName("0,2") as UAVariable;
            const el10 = uaVariable.getComponentByName("1,0") as UAVariable;
            const el11 = uaVariable.getComponentByName("1,1") as UAVariable;
            const el12 = uaVariable.getComponentByName("1,2") as UAVariable;

            // eslint-disable-next-line max-statements
            const verify = (array: { x: number, y: number, z: number }[]) => {

                const dataValue = uaVariable.readValue();
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue.value.arrayType.should.eql(VariantArrayType.Matrix);
                dataValue.value.dimensions!.should.eql([2, 3]);

                const dataValue00 = el00.readValue();
                dataValue00.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue00.value.arrayType.should.eql(VariantArrayType.Scalar);
                dataValue00.value.value.x.should.eql(array[0].x);
                dataValue00.value.value.y.should.eql(array[0].y);
                dataValue00.value.value.z.should.eql(array[0].z);

                const dataValue01 = el01.readValue();
                dataValue01.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue01.value.arrayType.should.eql(VariantArrayType.Scalar);

                dataValue01.value.value.x.should.eql(array[1].x);
                dataValue01.value.value.y.should.eql(array[1].y);
                dataValue01.value.value.z.should.eql(array[1].z);

                const dataValue02 = el02.readValue();
                dataValue02.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue02.value.arrayType.should.eql(VariantArrayType.Scalar);

                dataValue02.value.value.x.should.eql(array[2].x);
                dataValue02.value.value.y.should.eql(array[2].y);
                dataValue02.value.value.z.should.eql(array[2].z);

                const dataValue10 = el10.readValue();
                dataValue10.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue10.value.arrayType.should.eql(VariantArrayType.Scalar);

                dataValue10.value.value.x.should.eql(array[3].x);
                dataValue10.value.value.y.should.eql(array[3].y);
                dataValue10.value.value.z.should.eql(array[3].z);

                const dataValue11 = el11.readValue();
                dataValue11.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue11.value.arrayType.should.eql(VariantArrayType.Scalar);

                dataValue11.value.value.x.should.eql(array[4].x);
                dataValue11.value.value.y.should.eql(array[4].y);
                dataValue11.value.value.z.should.eql(array[4].z);

                const dataValue12 = el12.readValue();
                dataValue12.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue12.value.arrayType.should.eql(VariantArrayType.Scalar);

                dataValue12.value.value.x.should.eql(array[5].x);
                dataValue12.value.value.y.should.eql(array[5].y);
                dataValue12.value.value.z.should.eql(array[5].z);

                const extGlobal = dataValue.value.value as any[];
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue.value.arrayType.should.eql(VariantArrayType.Matrix);

                extGlobal[0].x.should.eql(array[0].x);
                extGlobal[0].y.should.eql(array[0].y);
                extGlobal[0].z.should.eql(array[0].z);

                extGlobal[1].x.should.eql(array[1].x);
                extGlobal[1].y.should.eql(array[1].y);
                extGlobal[1].z.should.eql(array[1].z);

                extGlobal[2].x.should.eql(array[2].x);
                extGlobal[2].y.should.eql(array[2].y);
                extGlobal[2].z.should.eql(array[2].z);

                extGlobal[3].x.should.eql(array[3].x);
                extGlobal[3].y.should.eql(array[3].y);
                extGlobal[3].z.should.eql(array[3].z);

                extGlobal[4].x.should.eql(array[4].x);
                extGlobal[4].y.should.eql(array[4].y);
                extGlobal[4].z.should.eql(array[4].z);

                extGlobal[5].x.should.eql(array[5].x);
                extGlobal[5].y.should.eql(array[5].y);
                extGlobal[5].z.should.eql(array[5].z);

            }
            should.exist(el00);
            should.exist(el01);
            should.exist(el02);
            should.exist(el10);
            should.exist(el11);
            should.exist(el12);

            verify([
                { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
            ]);


            {
                await simulateExternalWrite(el11.getComponentByName("X")!, 33, new Date(Date.UTC(2022, 0, 3, 0, 0, 0)));


                verify([
                    { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                    { x: 1, y: 2, z: 3 }, { x: 33, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                ]);

            }
            {

                await simulateExternalWriteEx(el11, p4.clone(), new Date(Date.UTC(2022, 0, 4, 0, 0, 0)));

                const dataValue = el11.readValue();
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue.value.value.x.should.eql(p4.x);
                dataValue.value.value.y.should.eql(p4.y);
                dataValue.value.value.z.should.eql(p4.z);
                verify([
                    { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                    { x: 1, y: 2, z: 3 }, p4, { x: 7, y: 8, z: 9 },
                ]);
            }

            // now change again some of the individual property
            {

                await simulateExternalWrite(el11.getComponentByName("X")!, 100, new Date(Date.UTC(2022, 0, 5, 0, 0, 0)));

                const dataValue = el11.readValue();
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                dataValue.value.value.x.should.eql(100);
                dataValue.value.value.y.should.eql(p4.y);
                dataValue.value.value.z.should.eql(p4.z);
                verify([
                    { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                    { x: 1, y: 2, z: 3 }, { ...p4, x: 100 }, { x: 7, y: 8, z: 9 },
                ]);
            }

        });
    });

    it("D3-1- edge case - calling bindExtensionObject twice", () => {

        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "D4",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite")
        });

        uaVariable.bindExtensionObject(p1.clone(), { createMissingProp: false });

        uaVariable.bindExtensionObject(p1.clone(), { createMissingProp: true });

    });
    it("D3-2- edge case - calling bindExtensionObject followed by installExtensionObjectVariables", () => {

        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "D4",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite")
        });

        uaVariable.bindExtensionObject(p1.clone(), { createMissingProp: false });
        should.not.exist(uaVariable.getComponentByName("X"));

        uaVariable.installExtensionObjectVariables();
        should.exist(uaVariable.getComponentByName("X"));

        uaVariable.installExtensionObjectVariables();
        should.exist(uaVariable.getComponentByName("X"));

    });

    it("D4-1- edge case - array - calling bindExtensionObject twice", () => {

        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "D4",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            valueRank: 1,
            arrayDimensions: [2]
        });

        uaVariable.bindExtensionObject([p1.clone(), p2.clone()], { createMissingProp: false });
        should.exist(uaVariable.getComponentByName("0"));
        should.not.exist(uaVariable.getComponentByName("0")!.getComponentByName("X"));

        uaVariable.bindExtensionObject([p1.clone(), p2.clone()], { createMissingProp: true });
        should.exist(uaVariable.getComponentByName("0"));
        should.exist(uaVariable.getComponentByName("0")!.getComponentByName("X"));

    });
    it("D4-2- edge case - array - calling bindExtensionObject followed by installExtensionObjectVariables", () => {

        const uaVariable = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "D4",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            valueRank: 1,
            arrayDimensions: [2]
        });

        uaVariable.bindExtensionObject([p1.clone(), p2.clone()], { createMissingProp: false });
        should.exist(uaVariable.getComponentByName("0"));

        uaVariable.installExtensionObjectVariables();
        uaVariable.installExtensionObjectVariables();

        const el0 = uaVariable.getComponentByName("0");
        should.exist(el0);

    });

});