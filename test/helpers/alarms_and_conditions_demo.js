var assert = require("better-assert");

function construct_demo_alarm_in_address_space(test,addressSpace) {

    addressSpace.installAlarmsAndConditionsService();

    var tank =  addressSpace.addObject({
        browseName: "Tank",
        description: "The Object representing the Tank",
        organizedBy: addressSpace.rootFolder.objects,
        notifierOf:  addressSpace.rootFolder.objects.server
    });


    var tankLevel = addressSpace.addVariable({
        browseName: "TankLevel",
        description: "Fill level in percentage (0% to 100%) of the water tank",
        propertyOf: tank,
        dataType: "Double",
        eventSourceOf: tank
    });

    //---------------------------------------------------------------------------------
    // Let's create a exclusive Limit Alarm that automatically raise itself
    // when the tank level is out of limit
    //---------------------------------------------------------------------------------

    var exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
    assert(exclusiveLimitAlarmType != null);

    var tankLevelCondition = addressSpace.instantiateExclusiveLimitAlarm(exclusiveLimitAlarmType,{
        componentOf:     tank,
        conditionSource: tankLevel,
        browseName:      "TankLevelCondition",
        optionals: [
            "ConfirmedState", "Confirm" // confirm state and confirm Method
        ],
        inputNode:       tankLevel,   // the variable that will be monitored for change
        highHighLimit:       0.9,
        highLimit:           0.8,
        lowLimit:            0.2
    });

    // ----------------------------------------------------------------
    // tripAlarm that signals that the "Tank lid" is opened
    var tripAlarmType = addressSpace.findEventType("TripAlarmType");

    var tankTripCondition = null;
    // to
    // ---------------------------
    // create a retain condition
    //xx tankLevelCondition.currentBranch().setRetain(true);
    //xx tankLevelCondition.raiseNewCondition({message: "Tank is almost 70% full", severity: 100, quality: StatusCodes.Good});

    test.tankLevel = tankLevel;
    test.tankLevelCondition = tankLevelCondition;
    test.tankTripCondition  = tankTripCondition;

}
exports.construct_demo_alarm_in_address_space =construct_demo_alarm_in_address_space;
