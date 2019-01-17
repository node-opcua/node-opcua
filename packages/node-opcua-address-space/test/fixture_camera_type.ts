import * as should from "should";

import { QualifiedName } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { AddressSpace, InstantiateOptions, UAMethod, UAObject, UAObjectType} from "..";

export interface FakeCamera extends UAObject {
    trigger: UAMethod;
}
export interface FakeCameraType extends UAObjectType {
    trigger: UAMethod;
    instantiate(options: InstantiateOptions): FakeCamera;
}

export function createCameraType(addressSpace: AddressSpace) {

    const namespace = addressSpace.getOwnNamespace();

    let cameraType = namespace.findObjectType("1:CameraType");
    if (cameraType) { return cameraType; }

    cameraType = namespace.addObjectType({
        browseName: "CameraType"
    }) as FakeCameraType;

    // MachineType.HeaderSwitch
    const triggerMethod = namespace.addMethod(cameraType, {

        browseName: "Trigger",

        inputArguments: [
            {
                dataType: DataType.UInt32,
                description: {text: "specifies the number of seconds to wait before the picture is taken "},
                name: "ShutterLag",
            }
        ],

        modellingRule: "Mandatory",

        outputArguments: [
            {
                dataType: "Image",
                description: {text: "the generated image"},
                name: "Image",
            }
        ]
    });

    triggerMethod.modellingRule!.should.eql("Mandatory");
    triggerMethod.browseName.toString().should.eql("1:Trigger");
    triggerMethod.browseName.should.eql(new QualifiedName({name: "Trigger", namespaceIndex: 1}));

    return cameraType as FakeCameraType;
}
