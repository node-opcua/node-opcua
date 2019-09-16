const sinon = require("sinon");
const treeify = require('treeify');

const {
    installAlarmMonitoring,
    uninstallAlarmMonitoring,
    OPCUAClient,
    acknwoledgeAllConditions,
    confirmAllConditions,
    dumpEvent
} = require("node-opcua-client");
const { construct_demo_alarm_in_address_space } = require("node-opcua-address-space");
const chalk = require("chalk");
const { perform_operation_on_subscription_async } = require("../../../test_helpers/perform_operation_on_client_session");

const Table = require("cli-table3");

const truncate = require('cli-truncate');
 
function ellipsys(a) {
    if(!a) { return ""; }
    return truncate(a,10,{ position: "middle"});
}
function displayAlarms(alarms/*: ClientAlarmList*/) {

    console.log("-----");

    const table = new Table({
        head: ["EventType", "ConditionId", "BranchId", "EventId",  "Enabled?", "Active?", "Message", "Severity", "Comment", "Acked?", "Confirmed?", "Retain"]
    });
    for (const alarm of alarms.alarms()) {

        const fields = alarm.fields/* as any*/;
        const isEnabled = fields.enabledState.id.value ;
        table.push([
            alarm.eventType.toString(),
            alarm.conditionId.toString(),
            fields.branchId.value.toString(),
            ellipsys(alarm.eventId.toString("hex")),
            fields.enabledState.id.value.toString(),
            isEnabled ? fields.activeState.id.value : "-",
            isEnabled ? ellipsys(fields.message.value.text) : "-",
            isEnabled ? fields.severity.value + ' (' + fields.lastSeverity.value + ')' : "-",
            isEnabled ? ellipsys(fields.comment.value.text) : "-",
            isEnabled ? fields.ackedState.id.value.toString() : "-",
            fields.confirmedState.id.value,
            fields.retain.value,
        ])
    }
    console.log(table.toString());
    console.log("-----");
}


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {


    describe("A&C3 client side alarm monitoring", async () => {

        let client;
        before(function (done) {


            // add a condition to the server
            // Server - HasNotifier -> Tank -> HasEventSource -> TankLevel -> HasCondition -> TankLevelCondition

            const addressSpace = test.server.engine.addressSpace;
            construct_demo_alarm_in_address_space(test, addressSpace);
            client = OPCUAClient.create({});

            function resetConditions(test) {
                // set alarms to a known state
                test.tankLevelCondition.setEnabledState(true);
                test.tankLevelCondition.currentBranch().setRetain(false);
                test.tankLevelCondition.currentBranch().setAckedState(false);
                test.tankLevelCondition.currentBranch().setConfirmedState(false);
    
                test.tankLevelCondition2.setEnabledState(true);
                test.tankLevelCondition2.currentBranch().setRetain(false);
                test.tankLevelCondition2.currentBranch().setAckedState(false);
                test.tankLevelCondition2.currentBranch().setConfirmedState(false);
    
                test.tankLevel.setValueFromSource({ dataType: "Double", value: 0.5 });
                test.tankLevel2.setValueFromSource({ dataType: "Double", value: 0.5 })
    
                console.log(test.tankLevelCondition.currentBranch().toString());
                console.log(test.tankLevelCondition2.currentBranch().toString());

            }

            resetConditions(test);

            done();
        });
        after(function (done) {
            client = null;
            done();
        });

        function setAlarmHighHigh() {
            // let's simulate the tankLevel going to 99%
            // the alarm should be raised
            test.tankLevel.setValueFromSource({
                dataType: "Double",
                value: 0.99
            });
            test.tankLevelCondition.limitState.getCurrentState().should.eql("HighHigh");
        }
        function setAlarmLowLow() {
            // let's simulate the tankLevel going to 1%
            // the alarm should be raised
            test.tankLevel.setValueFromSource({
                dataType: "Double",
                value: 0.01
            });
            test.tankLevelCondition.limitState.getCurrentState().should.eql("LowLow");
        }
        async function pause() {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        it("should monitor all alarms", async () => {

            await perform_operation_on_subscription_async(client, test.endpointUrl,
                async (session, subscription) => {

        
                    // make sure no alarm exists anymore


                    /**
                     * @param alarms {ClientAlarm[]}
                     */
                    function d(alarms) {
                        
                        function n(o) {
                            const no = test.tankLevel.addressSpace.findNode(o);
                            return no ? no.browseName.toString() + " " + no.nodeId.toString() : o.toString();
                        }
                        function dd(alarm) {
                            const a = alarm.fields;
                            console.log(n(alarm.eventType.value), n(alarm.conditionId),
                             "retain: " + a.retain.id.value,
                              "acked: " + a.acked.id.value);
                            //console.log(treeify.asTree(a.fields, true));
                        }
                        for (a of alarms) {
                            dd(a);
                        }
                    }
                    const addressSpace = test.server.engine.addressSpace;
                    const server = addressSpace.findNode("Server");
                    server.on("event", (eventData/*: RaiseEventData*/) => {
                        return;
                        console.log("qqqqqqqqqqqqqqqqqqqqqq");
                        console.log(eventData.eventId.value.toString("hex"));
                        console.log(eventData.eventType.value);
                        if (eventData.retain) {
                            console.log("retain = ", eventData.retain.value);
                        }
                        console.log(Object.keys(eventData).join(" "));
                    });

                    // Given a client that monitor alarms
                    await pause();
                    await pause();
                    console.log("---------------------------------------------------------------------- After Wait");
                    const alarms = await installAlarmMonitoring(session);
                    displayAlarms(alarms);
                    // we should have no alarm  to start with
                    alarms.length.should.eql(0);

                    test.tankLevel.setValueFromSource({ dataType: "Double", value: 0.1 });
                    await pause();
                    displayAlarms(alarms);
                    alarms.length.should.eql(1);
                    alarms.alarms()[0].fields.ackedState.id.value.should.eql(false);
                    alarms.alarms()[0].fields.confirmedState.id.value.should.eql(false);
                    alarms.alarms()[0].fields.retain.value.should.eql(true);
                    alarms.alarms()[0].fields.activeState.id.value.should.eql(true);

                    test.tankLevel2.setValueFromSource({ dataType: "Double", value: 0.1 });
                    await pause();
                    displayAlarms(alarms);
                    alarms.length.should.eql(2);
                    
                    // all alarms should have !acked !confirmed
                    alarms.alarms()[0].fields.ackedState.id.value.should.eql(false);
                    alarms.alarms()[0].fields.confirmedState.id.value.should.eql(false);
                    alarms.alarms()[0].fields.retain.value.should.eql(true);
                    alarms.alarms()[0].fields.activeState.id.value.should.eql(true);

                    alarms.alarms()[1].fields.ackedState.id.value.should.eql(false);
                    alarms.alarms()[1].fields.confirmedState.id.value.should.eql(false);
                    alarms.alarms()[1].fields.retain.value.should.eql(true);
                    alarms.alarms()[1].fields.activeState.id.value.should.eql(true);


                    test.tankLevel.setValueFromSource({ dataType: "Double", value: 0.5 });
                    await pause();
                    displayAlarms(alarms);
                    alarms.length.should.eql(2);

                    // back to normal for alarm 2 also
                    test.tankLevel2.setValueFromSource({ dataType: "Double", value: 0.5 });
                    await pause();
                    displayAlarms(alarms);

                    // now lets acknoweldege all alarms
                    await acknwoledgeAllConditions(session, "Acked by test");
                    alarms.alarms()[0].fields.ackedState.id.value.should.eql(true);
                    alarms.alarms()[0].fields.confirmedState.id.value.should.eql(false);
                    alarms.alarms()[0].fields.retain.value.should.eql(true);
                    alarms.alarms()[0].fields.activeState.id.value.should.eql(false);

                    alarms.alarms()[1].fields.ackedState.id.value.should.eql(true);
                    alarms.alarms()[1].fields.confirmedState.id.value.should.eql(false);
                    alarms.alarms()[1].fields.retain.value.should.eql(true);
                    alarms.alarms()[1].fields.activeState.id.value.should.eql(false);

                    await confirmAllConditions(session, "Confirmed by test");
                    await pause();
                    displayAlarms(alarms);
                    alarms.length.should.eql(2);
                    // console.log(alarms.alarms()[0].fields);
                    alarms.alarms()[0].fields.ackedState.id.value.should.eql(true);
                    alarms.alarms()[0].fields.confirmedState.id.value.should.eql(true);
                    alarms.alarms()[0].fields.retain.value.should.eql(false);
                    alarms.alarms()[0].fields.activeState.id.value.should.eql(false);


                    alarms.alarms()[1].fields.ackedState.id.value.should.eql(true);
                    alarms.alarms()[1].fields.confirmedState.id.value.should.eql(true);
                    alarms.alarms()[1].fields.retain.value.should.eql(false);
                    alarms.alarms()[1].fields.activeState.id.value.should.eql(false);

                    alarms.purgeUnusedAlarms();
                    displayAlarms(alarms);
                    alarms.length.should.eql(0);

                    await uninstallAlarmMonitoring(session);

                });

        })

    });

};
