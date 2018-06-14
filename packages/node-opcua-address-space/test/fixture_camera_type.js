"use strict";



const should = require("should");
const DataType = require("node-opcua-variant").DataType;
const QualifiedName = require("node-opcua-data-model").QualifiedName;

exports.createCameraType = function createCameraType(addressSpace) {

    const namespace = addressSpace.getPrivateNamespace();

    let cameraType = namespace.findObjectType("1:CameraType");
    if (cameraType) { return cameraType; }

    cameraType = namespace.addObjectType({browseName: "CameraType"});

    // MachineType.HeaderSwitch
    const triggerMethod = namespace.addMethod(cameraType, {

        modellingRule: "Mandatory",

        browseName: "Trigger",

        inputArguments: [
            {
                name: "ShutterLag",
                description: {text: "specifies the number of seconds to wait before the picture is taken "},
                dataType: DataType.UInt32
            }
        ],

        outputArguments: [
            {
                name: "Image",
                description: {text: "the generated image"},
                dataType: "Image"
            }
        ]
    });

    triggerMethod.modellingRule.should.eql("Mandatory");
    should(triggerMethod.typeDefinition).eql(null);
    triggerMethod.browseName.toString().should.eql("1:Trigger");
    triggerMethod.browseName.should.eql(new QualifiedName({name: "Trigger", namespaceIndex: 1}));

    return cameraType;
};
