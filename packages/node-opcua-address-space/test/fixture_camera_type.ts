import * as should from "should";

import { QualifiedName } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { IAddressSpace, UAMethod, UAObject, UAObjectType, UAVariableT, InstantiateObjectOptions } from "..";

export interface FakeCamera extends UAObject {
    trigger: UAMethod;
    pictureTakenCount: UAVariableT<number, DataType.UInt32>;
}
export interface FakeCameraType extends UAObjectType {
    trigger: UAMethod;
    instantiate(options: InstantiateObjectOptions): FakeCamera;
}

export function createCameraType(addressSpace: IAddressSpace): FakeCameraType {
    const namespace = addressSpace.getOwnNamespace();

    let cameraType = namespace.findObjectType("CameraType") as FakeCameraType;
    if (cameraType) {
        return cameraType as FakeCameraType;
    }

    cameraType = namespace.addObjectType({
        browseName: "CameraType"
    }) as FakeCameraType;

    // MachineType.HeaderSwitch
    const triggerMethod = namespace.addMethod(cameraType, {
        browseName: "Trigger",

        inputArguments: [
            {
                dataType: DataType.UInt32,
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                name: "ShutterLag"
            }
        ],

        modellingRule: "Mandatory",

        outputArguments: [
            {
                dataType: "Image",
                description: { text: "the generated image" },
                name: "Image"
            }
        ]
    });

    triggerMethod.modellingRule!.should.eql("Mandatory");
    triggerMethod.browseName.toString().should.eql("1:Trigger");
    triggerMethod.browseName.should.eql(new QualifiedName({ name: "Trigger", namespaceIndex: 1 }));

    namespace.addVariable({
        browseName: "PictureTakenCount",
        description: "The number of pictures taken since the last reset",
        dataType: "UInt32",
        modellingRule: "Mandatory",
        componentOf: cameraType
    });

    return cameraType as FakeCameraType;
}
