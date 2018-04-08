"use strict";



const should = require("should");
const DataType = require("node-opcua-variant").DataType;
const QualifiedName = require("node-opcua-data-model").QualifiedName;

exports.createCameraType = function createCameraType(addressSpace) {

    let cameraType = addressSpace.findObjectType("1:CameraType");
    if (cameraType) { return cameraType; }

    cameraType = addressSpace.addObjectType({browseName: "1:CameraType"});

    // MachineType.HeaderSwitch
    const triggerMethod = addressSpace.addMethod(cameraType, {

        modellingRule: "Mandatory",

        browseName: "1:Trigger",

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
