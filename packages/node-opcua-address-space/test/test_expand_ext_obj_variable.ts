import * as should from "should";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataTypeIds } from "node-opcua-constants";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { ThreeDCartesianCoordinates } from "node-opcua-types";
import { StatusCodes } from "node-opcua-status-code";
import { AttributeIds } from "node-opcua-basic-types";
import { makeAccessLevelFlag } from "node-opcua-data-model";

import { AddressSpace, INamespace, PseudoSession, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";


// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Extending extension object variables", function () {

    this.timeout(Math.max(this.timeout(), 100000));
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

    it("should expand a scalar extension object variable", async () => {
        const v = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V1",
            organizedBy: addressSpace.rootFolder.objects.server,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite")
        });
        v.setValueFromSource({
            value: p1.clone(),
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.ExtensionObject
        }, StatusCodes.Good, new Date(Date.UTC(2022, 0, 1, 0, 0, 0)));
        v.readValue().sourceTimestamp?.toISOString().should.eql("2022-01-01T00:00:00.000Z");

        v.installExtensionObjectVariables();

        // the inner propertis of the extension should now be exposed
        const uaX = v.getComponentByName("X")! as UAVariable;
        const uaY = v.getComponentByName("Y")! as UAVariable;
        const uaZ = v.getComponentByName("Z")! as UAVariable;

        uaX.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");
        uaY.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");
        uaZ.typeDefinitionObj.browseName.toString().should.eql("BaseDataVariableType");

        should.exist(uaX);
        should.exist(uaY);
        should.exist(uaZ);

        const verify = ({ x, y, z }: { x: number, y: number, z: number }) => {
            const dataValue = v.readValue();
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
        const session = new PseudoSession(addressSpace);
        const statusCode1 = await session.write({
            nodeId: uaZ.nodeId,
            value: { value: { dataType: DataType.Double, value: 33 } },
            attributeId: AttributeIds.Value
        });

        statusCode1.should.eql(StatusCodes.Good);

        const zDataValue2 = uaZ.readValue();
        zDataValue2.value.dataType.should.eql(DataType.Double);
        zDataValue2.value.value.should.eql(33);

        verify({ x: 1, y: 2, z: 33 });
        // 

        const statusCode2 = await session.write({
            nodeId: v.nodeId,
            value: { value: { dataType: DataType.ExtensionObject, value: p2.clone() } },
            attributeId: AttributeIds.Value
        });
        statusCode2.should.eql(StatusCodes.Good);
        verify({ x: 4, y: 5, z: 6 });

    });

    it("should expand a array extension object variable", () => {
        const v = namespace.addVariable({
            dataType: extensionObjectDataType,
            nodeId: "s=\"SomeData\"",
            browseName: "V2",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 1,
        });
        v.setValueFromSource({
            value: [p1, p2],
            arrayType: VariantArrayType.Array,
            dataType: DataType.ExtensionObject
        }, StatusCodes.Good, new Date(Date.UTC(2022, 0, 1)));

        v.installExtensionObjectVariables();

        const el0 = v.getComponentByName("0") as UAVariable;
        el0?.nodeId.toString().should.eql(v.nodeId?.toString() + "[0]");

        const el1 = v.getComponentByName("1") as UAVariable;
        el1?.nodeId.toString().should.eql(v.nodeId?.toString() + "[1]");

        console.log(v.toString());
        should.exist(el0);
        should.exist(el1);

        const dataValue = v.readValue();
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

            const dataValue = v.readValue();
            dataValue.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue.value.arrayType.should.eql(VariantArrayType.Array);

            const dataValue00 = el0.readValue();
            dataValue00.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue00.value.arrayType.should.eql(VariantArrayType.Scalar);
            dataValue00.value.value.x.should.eql(array[0].x);
            dataValue00.value.value.y.should.eql(array[0].y);
            dataValue00.value.value.z.should.eql(array[0].z);

            const dataValue01 = el1.readValue();
            dataValue01.value.value.x.should.eql(array[1].x);
            dataValue01.value.value.y.should.eql(array[1].y);
            dataValue01.value.value.z.should.eql(array[1].z);

        }
        verify([{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }])
    });

    it("should expand a matrix extension object variable", async () => {
        const v = namespace.addVariable({
            dataType: extensionObjectDataType,
            browseName: "V2",
            organizedBy: addressSpace.rootFolder.objects.server,
            valueRank: 2,
            arrayDimensions: [2, 3]
        });
        v.setValueFromSource({
            value: [p1, p2, p3, p1, p2, p3,],
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            dataType: DataType.ExtensionObject
        });

        v.installExtensionObjectVariables();

        console.log(v.toString());

        const el00 = v.getComponentByName("0,0") as UAVariable;
        const el01 = v.getComponentByName("0,1") as UAVariable;
        const el02 = v.getComponentByName("0,2") as UAVariable;
        const el10 = v.getComponentByName("1,0") as UAVariable;
        const el11 = v.getComponentByName("1,1") as UAVariable;
        const el12 = v.getComponentByName("1,2") as UAVariable;

        const verify = (array: { x: number, y: number, z: number }[]) => {

            const dataValue = v.readValue();
            dataValue.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue.value.arrayType.should.eql(VariantArrayType.Array);

            const dataValue00 = el00.readValue();
            dataValue00.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue00.value.arrayType.should.eql(VariantArrayType.Scalar);
            dataValue00.value.value.x.should.eql(array[0].x);
            dataValue00.value.value.y.should.eql(array[0].y);
            dataValue00.value.value.z.should.eql(array[0].z);

            const dataValue01 = el01.readValue();
            dataValue01.value.value.x.should.eql(array[1].x);
            dataValue01.value.value.y.should.eql(array[1].y);
            dataValue01.value.value.z.should.eql(array[1].z);

            const dataValue02 = el02.readValue();
            dataValue02.value.value.x.should.eql(array[2].x);
            dataValue02.value.value.y.should.eql(array[2].y);
            dataValue02.value.value.z.should.eql(array[2].z);

            const dataValue10 = el10.readValue();
            dataValue10.value.value.x.should.eql(array[3].x);
            dataValue10.value.value.y.should.eql(array[3].y);
            dataValue10.value.value.z.should.eql(array[3].z);

            const dataValue11 = el11.readValue();
            dataValue11.value.value.x.should.eql(array[4].x);
            dataValue11.value.value.y.should.eql(array[4].y);
            dataValue11.value.value.z.should.eql(array[4].z);

            const dataValue12 = el12.readValue();
            dataValue12.value.value.x.should.eql(array[5].x);
            dataValue12.value.value.y.should.eql(array[5].y);
            dataValue12.value.value.z.should.eql(array[5].z);
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

            const session = new PseudoSession(addressSpace);
            const statusCode1 = await session.write({
                nodeId: el11.getComponentByName("X")!.nodeId,
                value: { value: { dataType: DataType.Double, value: 33 } },
                attributeId: AttributeIds.Value
            });

            statusCode1.should.eql(StatusCodes.Good);

            const zDataValue2 = (el11.getComponentByName("X")! as UAVariable).readValue();
            zDataValue2.value.dataType.should.eql(DataType.Double);
            zDataValue2.value.value.should.eql(33);

            verify([
                { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
                { x: 1, y: 2, z: 3 }, { x: 33, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
            ]);

        }
        {

            const session = new PseudoSession(addressSpace);
            const statusCode1 = await session.write({
                nodeId: el11.nodeId,
                value: { value: { value: p4.clone(), dataType: DataType.ExtensionObject } },
                attributeId: AttributeIds.Value
            });

            statusCode1.should.eql(StatusCodes.Good);

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

    });
});