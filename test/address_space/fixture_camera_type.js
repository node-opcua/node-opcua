"use strict";
require("requirish")._(module);
require("lib/address_space/address_space_add_method");
var should = require("should");
var DataType = require("lib/datamodel/variant").DataType;

exports.createCameraType = function createCameraType(address_space) {


    var cameraType = address_space.addObjectType({ browseName: "CameraType" });

    // MachineType.HeaderSwitch
    var triggerMethod = address_space.addMethod(cameraType,{
        browseName: "Trigger",

        inputArguments:  [
            {
                name:"ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: DataType.UInt32
            }
        ],

        outputArguments: [
            {
                name:"Image",
                description:{ text: "the generated image" },
                dataType: "Image"
            }
        ]
    });
    triggerMethod.browseName.should.eql("Trigger");
    return cameraType;
};
