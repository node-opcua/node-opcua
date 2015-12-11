"use strict";
require("requirish")._(module);
require("lib/address_space/address_space_add_method");
var should = require("should");
var DataType = require("lib/datamodel/variant").DataType;
var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;

exports.createCameraType = function createCameraType(addressSpace) {

    var cameraType = addressSpace.findObjectType("1:CameraType");
    if (cameraType) { return cameraType; }

    cameraType = addressSpace.addObjectType({browseName: "1:CameraType"});

    // MachineType.HeaderSwitch
    var triggerMethod = addressSpace.addMethod(cameraType, {

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
