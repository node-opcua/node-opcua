/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { AddressSpace,UANonExclusiveLimitAlarmEx, UAExclusiveLimitAlarmEx, UAObject, UAVariable } from "..";


export interface IAlarmTestData {
    tankLevel: UAVariable;
    tankLevelCondition: UAExclusiveLimitAlarmEx;
    tankLevel2: UAVariable;
    tankLevelCondition2: UANonExclusiveLimitAlarmEx;
    tankTripCondition: null;
}

export function construct_demo_alarm_in_address_space(test: IAlarmTestData, addressSpace: AddressSpace): void {
    const a = addressSpace as any;
    if (a.construct_demo_alarm_in_address_space_called) {
        return;
    }
    a.construct_demo_alarm_in_address_space_called = true;

    addressSpace.installAlarmsAndConditionsService();

    const namespace = addressSpace.getOwnNamespace();

    const tank = namespace.addObject({
        browseName: "Tank",
        description: "The Object representing the Tank",
        eventNotifier: 0x01,
        notifierOf: addressSpace.rootFolder.objects.server,
        organizedBy: addressSpace.rootFolder.objects
    });
    assert(tank.getNotifiers().length === 0, "expecting a notifier now");

    const tankLevel = namespace.addVariable({
        browseName: "TankLevel",
        componentOf: tank,
        dataType: "Double",
        description: "Fill level in percentage (0% to 100%) of the water tank",
        eventSourceOf: tank,
        value: { dataType: "Double", value: 0.5 }
    });
    //    assert(tank.getNotifiers().length === 1, "expecting a notifier now");

    // --------------------------------------------------------------------------------
    // Let's create a exclusive Limit Alarm that automatically raise itself
    // when the tank level is out of limit
    // --------------------------------------------------------------------------------

    const exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
    if (!exclusiveLimitAlarmType) {
        throw new Error("cannot find ExclusiveLimitAlarmType in namespace 0");
    }

    const tankLevelCondition = namespace.instantiateExclusiveLimitAlarm(exclusiveLimitAlarmType, {
        browseName: "TankLevelCondition",
        componentOf: tank,
        conditionName: "TankLevelCondition",
        conditionSource: tankLevel,

        highHighLimit: 0.9,
        highLimit: 0.8,

        inputNode: tankLevel, // the variable that will be monitored for change

        lowLimit: 0.2,

        optionals: [
            "ConfirmedState",
            "Confirm" // confirm state and confirm Method
        ]
    }) as UAExclusiveLimitAlarmEx;

    assert(tankLevelCondition.browseName.toString() === "1:TankLevelCondition");

    assert(tankLevel.findReferences("HasCondition").length === 1);
    assert(tankLevel.findReferencesAsObject("HasCondition", true).length === 1);

    const conditionName = tankLevel.findReferencesAsObject("HasCondition", true)[0].browseName.toString();
    const conditionTypeDefinition = (
        tankLevel.findReferencesAsObject("HasCondition", true)[0] as UAObject
    ).typeDefinitionObj.browseName.toString();
    const conditionJavascriptClass = tankLevel.findReferencesAsObject("HasCondition", true)[0].constructor.name.toString();
    if (false) {
        console.log(conditionName, conditionTypeDefinition, conditionJavascriptClass);
    }
    assert("1:TankLevelCondition" === conditionName);
    assert("ExclusiveLimitAlarmType" === conditionTypeDefinition);
    assert("UAExclusiveLimitAlarmImpl" === conditionJavascriptClass);

    // ----------------------------------------------------------------
    // tripAlarm that signals that the "Tank lid" is opened
    const tripAlarmType = addressSpace.findEventType("TripAlarmType");

    const tankTripCondition = null;
    // to
    // ---------------------------
    // create a retain condition
    // xx tankLevelCondition.currentBranch().setRetain(true);
    // xx tankLevelCondition.raiseNewCondition({message: "Tank is almost 70% full",
    //                                          severity: 100, quality: StatusCodes.Good});

    // -------------------------------------------------------------
    // Let's create a second variable with no Exclusive alarm
    // -------------------------------------------------------------
    const tankLevel2 = namespace.addVariable({
        browseName: "tankLevel2",
        componentOf: tank,
        dataType: "Double",
        description: "Fill level in percentage (0% to 100%) of the water tank",
        eventSourceOf: tank,
        value: { dataType: "Double", value: 0.5 }
    });

    const nonExclusiveLimitAlarmType = addressSpace.findEventType("NonExclusiveLimitAlarmType");
    if (!nonExclusiveLimitAlarmType) {
        throw new Error("!!");
    }

    const tankLevelCondition2 = namespace.instantiateNonExclusiveLimitAlarm(nonExclusiveLimitAlarmType, {
        browseName: "TankLevelCondition2",
        componentOf: tank,
        conditionName: "TankLevel2",
        conditionSource: tankLevel2,

        highHighLimit: 0.9,
        highLimit: 0.8,

        inputNode: tankLevel2, // the variable that will be monitored for change

        lowLimit: 0.2,

        optionals: [
            "ConfirmedState",
            "Confirm" // confirm state and confirm Method
        ]
    });
    assert(tankLevel2.findReferences("HasCondition").length === 1);
    assert(tankLevel2.findReferencesAsObject("HasCondition", true).length === 1);
    test.tankLevel = tankLevel;
    test.tankLevelCondition = tankLevelCondition;

    test.tankLevel2 = tankLevel2;
    test.tankLevelCondition2 = tankLevelCondition2;

    test.tankTripCondition = tankTripCondition;
}
