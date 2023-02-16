/* eslint-disable max-statements */
// tslint:disable: no-console
import * as should from "should";
import * as sinon from "sinon";

import { DateTime, Double, UAString, UInt32 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import { NodeIdLike } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import {
    ApplicationDescription,
    ServerState,
    ServerStatusDataType,
    ServiceCounterDataType,
    SessionDiagnosticsDataType
} from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { nodesets } from "node-opcua-nodesets";

import {
    AddressSpace,
    UARootFolder,
    UAVariable,
    UAVariableT,
    Namespace,
    UADataType,
    UAVariableType,
    UASessionDiagnosticsVariable,
    DTSessionDiagnostics,
    DTServiceCounter,
    UABaseDataVariable
} from "..";
import { getMiniAddressSpace } from "../testHelpers";
import { generateAddressSpace } from "../nodeJS";
import { assert } from "console";

const doDebug = false;

interface UAServiceCounterVariableEx extends UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject> {
    totalCount: UAVariableT<UInt32, DataType.UInt32>;
    errorCount: UAVariableT<UInt32, DataType.UInt32>;
}
interface UASessionDiagnosticsVariableEx extends UASessionDiagnosticsVariable<DTSessionDiagnostics> {
    totalRequestCount: UAServiceCounterVariableEx;
}

interface ServerStatusVariable extends UAVariable {
    startTime: UAVariableT<DateTime, DataType.DateTime>;
    currentTime: UAVariableT<DateTime, DataType.DateTime>;
    state: UAVariableT<any, DataType.ExtensionObject>; // ServerState
    buildInfo: UAVariableT<any, DataType.ExtensionObject>; // BuildInfoOptions
    secondsTillShutdown: UAVariableT<UInt32, DataType.UInt32>;
    shutdownReason: UAVariableT<LocalizedText, DataType.LocalizedText>;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Extension Object binding and sub  components\n", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });

    describe("bindObject", () => {
        it("BEO4 - should handle a Variable containing an array of ServiceCounterDataType", () => {
            const rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            const serviceCounterDataType = addressSpace.findDataType("ServiceCounterDataType")!;
            serviceCounterDataType.browseName.toString().should.eql("ServiceCounterDataType");

            const baseVariableType = addressSpace.findVariableType("BaseVariableType")!;
            baseVariableType.browseName.toString().should.eql("BaseVariableType");

            const namespace = addressSpace.getOwnNamespace();

            const counter = 1;
            const extensionObjectVar = namespace.addVariable({
                browseName: "VariableWithExtensionObjectArray" + counter,
                dataType: serviceCounterDataType.nodeId,
                valueRank: 1,
                arrayDimensions: [0],
                minimumSamplingInterval: 0,
                organizedBy: rootFolder.objects
            });
            should.not.exist(extensionObjectVar.getComponentByName("0"));
            should.not.exist(extensionObjectVar.getComponentByName("1"));

            extensionObjectVar.minimumSamplingInterval.should.eql(0);

            extensionObjectVar.readValue().value.dataType.should.eql(DataType.Null); // Empty array
            extensionObjectVar.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

            const extensionObjectArray = extensionObjectVar.bindExtensionObjectArray([
                new ServiceCounterDataType({ errorCount: 1, totalCount: 2 }),
                new ServiceCounterDataType({ errorCount: 3, totalCount: 4 })
            ], { createMissingProp: true }) as ServiceCounterDataType[];
            should.exist(extensionObjectVar.getComponentByName("0"));
            should.exist(extensionObjectVar.getComponentByName("1"));
            should.exist(extensionObjectVar.getComponentByName("0")!.getChildByName("TotalCount"));
            should.exist(extensionObjectVar.getComponentByName("1")!.getChildByName("TotalCount"));

            extensionObjectVar.installExtensionObjectVariables();
            should.exist(extensionObjectVar.getComponentByName("0"));
            should.exist(extensionObjectVar.getComponentByName("1"));
            should.exist(extensionObjectVar.getComponentByName("0")!.getChildByName("TotalCount"));
            should.exist(extensionObjectVar.getComponentByName("1")!.getChildByName("TotalCount"));

            extensionObjectArray.length.should.eql(2);
            extensionObjectArray[0].constructor.name.should.eql("ServiceCounterDataType");
            extensionObjectArray[1].constructor.name.should.eql("ServiceCounterDataType");

            extensionObjectVar.readValue().statusCode.should.eql(StatusCodes.Good);
            extensionObjectVar.readValue().value.dataType.should.eql(DataType.ExtensionObject);
            extensionObjectVar.readValue().value.arrayType.should.eql(VariantArrayType.Array);
            extensionObjectVar.readValue().value.value.length.should.eql(2);
            extensionObjectVar.readValue().value.value[0].constructor.name.should.eql("ServiceCounterDataType");
            extensionObjectVar.readValue().value.value[1].constructor.name.should.eql("ServiceCounterDataType");

            // to do 
            const el1 = extensionObjectVar.getComponentByName("0") as UAVariable;
            const dataValueEl1 = el1.readValue();
            dataValueEl1.value.dataType.should.eql(DataType.ExtensionObject);
            dataValueEl1.value.arrayType.should.eql(VariantArrayType.Scalar);
            dataValueEl1.value.value.constructor.name.should.eql("ServiceCounterDataType");

            const el2 = extensionObjectVar.getComponentByName("1") as UAVariable;
            const dataValueEl2 = el2.readValue();
            dataValueEl2.value.dataType.should.eql(DataType.ExtensionObject);
            dataValueEl2.value.arrayType.should.eql(VariantArrayType.Scalar);
            dataValueEl2.value.value.constructor.name.should.eql("ServiceCounterDataType");
        });

        it("BEO1 - should handle a Variable containing a ServiceCounterDataType", () => {
            const rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            const serviceCounterDataType = addressSpace.findDataType("ServiceCounterDataType")!;
            serviceCounterDataType.browseName.toString().should.eql("ServiceCounterDataType");

            const baseVariableType = addressSpace.findVariableType("BaseVariableType")!;
            baseVariableType.browseName.toString().should.eql("BaseVariableType");

            const counter = 1;
            const extensionObjectVar = baseVariableType.instantiate({
                browseName: "VariableWithExtensionObject" + counter,
                dataType: serviceCounterDataType.nodeId,
                valueRank: -1,
                minimumSamplingInterval: 0,
                organizedBy: rootFolder.objects
            }) as UAServiceCounterVariableEx;

            should.exist(extensionObjectVar.$extensionObject);
            // should.not.exist(extensionObjectVar.$$extensionObjectArray);
            should.not.exist(extensionObjectVar.getChildByName("TotalCount"));
            should.not.exist(extensionObjectVar.getChildByName("ErrorCount"));

            extensionObjectVar.installExtensionObjectVariables();
            should.exist(extensionObjectVar.getChildByName("TotalCount"));
            should.exist(extensionObjectVar.getChildByName("ErrorCount"));

            extensionObjectVar.minimumSamplingInterval.should.eql(0);

            // xx console.log(extensionObjectVar.readValue());

            extensionObjectVar.readValue().value.dataType.should.eql(DataType.ExtensionObject);
            extensionObjectVar.readValue().statusCode.should.eql(StatusCodes.Good);

            extensionObjectVar.totalCount.readValue().value.dataType.should.eql(DataType.UInt32);
            extensionObjectVar.totalCount.readValue().statusCode.should.eql(StatusCodes.Good);

            const extensionObject = extensionObjectVar.bindExtensionObject() as ServiceCounterDataType;
            extensionObject.constructor.name.should.eql("ServiceCounterDataType");

            // ------------------ Changing extension object value should reflects in node Value
            extensionObjectVar.readValue().value.value.totalCount.should.eql(0);
            extensionObject.totalCount = 3;
            extensionObjectVar.readValue().value.value.totalCount.should.eql(3);
            extensionObject.totalCount = 0;

            extensionObjectVar.totalCount.readValue().value.value.should.eql(0);
            extensionObject.totalCount = 3;
            extensionObjectVar.totalCount.readValue().value.value.should.eql(3);
            extensionObject.totalCount = 0;

            const spy_on_ServerCounter_value_changed = sinon.spy();
            const spy_on_ServerCounter_TotalCount_value_changed = sinon.spy();

            extensionObjectVar.on("value_changed", spy_on_ServerCounter_value_changed);
            extensionObjectVar.totalCount.on("value_changed", spy_on_ServerCounter_TotalCount_value_changed);

            extensionObject.totalCount = 3;
            spy_on_ServerCounter_value_changed.callCount.should.eql(1);
            spy_on_ServerCounter_TotalCount_value_changed.callCount.should.eql(1);
        });

        it("BEO2 - should handle a Variable containing a ServerStatus", () => {
            const rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            const serverStatusDataType = addressSpace.findDataType("ServerStatusDataType")!;
            serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");

            const serverStatusType = addressSpace.findVariableType("ServerStatusType")!;
            serverStatusType.browseName.toString().should.eql("ServerStatusType");

            const counter = 1;
            const extensionObjectVar = serverStatusType.instantiate({
                browseName: "ServerStatusType" + counter,
                dataType: serverStatusDataType.nodeId,
                minimumSamplingInterval: 0,
                organizedBy: rootFolder.objects
            }) as ServerStatusVariable;

            extensionObjectVar.minimumSamplingInterval.should.eql(0);

            const extensionObject = extensionObjectVar.bindExtensionObject() as ServerStatusDataType;
            extensionObject.constructor.name.should.eql("ServerStatusDataType");

            const spy_on_ServerStatus_value_changed = sinon.spy();
            const spy_on_ServerStatus_BuildInfo_value_changed = sinon.spy();
            const spy_on_ServerStatus_StartTime_value_changed = sinon.spy();
            const spy_on_ServerStatus_State_value_changed = sinon.spy();

            extensionObjectVar.on("value_changed", spy_on_ServerStatus_value_changed);
            extensionObjectVar.buildInfo.on("value_changed", spy_on_ServerStatus_BuildInfo_value_changed);
            extensionObjectVar.startTime.on("value_changed", spy_on_ServerStatus_StartTime_value_changed);
            extensionObjectVar.state.on("value_changed", spy_on_ServerStatus_State_value_changed);

            extensionObject.startTime = new Date();

            spy_on_ServerStatus_StartTime_value_changed.callCount.should.eql(1);
            spy_on_ServerStatus_value_changed.callCount.should.eql(1);

            extensionObject.buildInfo.productUri = "PRODUCTURI";
            spy_on_ServerStatus_BuildInfo_value_changed.callCount.should.eql(1);

            extensionObject.buildInfo.manufacturerName = "MANUFACTURER";
            spy_on_ServerStatus_BuildInfo_value_changed.callCount.should.eql(2);

            // ---------------------------------------- State ( testing Enumeration )
            extensionObject.state = ServerState.Running;
            spy_on_ServerStatus_State_value_changed.callCount.should.eql(1);
            extensionObjectVar.state.readValue().value.value.should.eql(ServerState.Running);

            extensionObject.state = ServerState.Suspended;
            spy_on_ServerStatus_State_value_changed.callCount.should.eql(2);
            extensionObjectVar.state.readValue().value.value.should.eql(ServerState.Suspended);
        });

        it("BEO3 - should handle a Variable containing a SessionDiagnostic", () => {
            const rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            const sessionDiagnosticsDataType = addressSpace.findDataType("SessionDiagnosticsDataType")!;
            sessionDiagnosticsDataType.browseName.toString().should.eql("SessionDiagnosticsDataType");

            const sessionDiagnosticsVariableType = addressSpace.findVariableType("SessionDiagnosticsVariableType")!;
            sessionDiagnosticsVariableType.browseName.toString().should.eql("SessionDiagnosticsVariableType");

            const counter = 1;
            const uaVariable = sessionDiagnosticsVariableType.instantiate({
                browseName: "SessionDiagnostics" + counter,
                dataType: sessionDiagnosticsDataType.nodeId,
                minimumSamplingInterval: 0,
                organizedBy: rootFolder.objects
            }) as UASessionDiagnosticsVariableEx;

            uaVariable.installExtensionObjectVariables();
            uaVariable.minimumSamplingInterval.should.eql(0);
            uaVariable.totalRequestCount.minimumSamplingInterval.should.eql(0);

            const useTwoLevelsDeep = false;

            useTwoLevelsDeep && uaVariable.totalRequestCount.totalCount.minimumSamplingInterval.should.eql(0);

            uaVariable.readValue().statusCode.should.eql(StatusCodes.Good);
            uaVariable.totalRequestCount.readValue().statusCode.should.eql(StatusCodes.Good);
            useTwoLevelsDeep && uaVariable.totalRequestCount.totalCount.readValue().statusCode.should.eql(StatusCodes.Good);
            useTwoLevelsDeep && uaVariable.totalRequestCount.errorCount.readValue().statusCode.should.eql(StatusCodes.Good);

            const extensionObject = uaVariable.bindExtensionObject() as SessionDiagnosticsDataType;

            extensionObject.constructor.name.should.eql("SessionDiagnosticsDataType");

            const spy_on_SessionDiagnostics_value_changed = sinon.spy();
            const spy_on_SessionDiagnostics_TotalRequestCount_value_changed = sinon.spy();
            const spy_on_SessionDiagnostics_TotalRequestCount_TotalCount_value_changed = sinon.spy();

            uaVariable.on("value_changed", spy_on_SessionDiagnostics_value_changed);
            uaVariable.totalRequestCount.on("value_changed", spy_on_SessionDiagnostics_TotalRequestCount_value_changed);
            useTwoLevelsDeep &&
                uaVariable.totalRequestCount.totalCount.on(
                    "value_changed",
                    spy_on_SessionDiagnostics_TotalRequestCount_TotalCount_value_changed
                );

            useTwoLevelsDeep && uaVariable.totalRequestCount.totalCount.readValue().value.value.should.eql(0);

            const dv1 = uaVariable.totalRequestCount.readValue();
            const dv2 = uaVariable.readValue();

            uaVariable.totalRequestCount.readValue().value.value.totalCount.should.eql(0);

            uaVariable.readValue().value.value.totalRequestCount.totalCount.should.eql(0);

            uaVariable.$extensionObject.should.eql(extensionObject);

            extensionObject.totalRequestCount.totalCount = 1;

            uaVariable.$extensionObject.should.eql(extensionObject);
            // xx sionObject.totalRequestCount = new Proxy(extensionObject.totalRequestCount,{});

            uaVariable.readValue().value.value.totalRequestCount.totalCount.should.eql(1);
            spy_on_SessionDiagnostics_value_changed.callCount.should.eql(1);

            uaVariable.totalRequestCount.readValue().value.value.totalCount.should.eql(1);
            spy_on_SessionDiagnostics_TotalRequestCount_value_changed.callCount.should.eql(1);

            // xx console.log(extensionObjectVar.totalRequestCount.totalCount.readValue());
            useTwoLevelsDeep && spy_on_SessionDiagnostics_TotalRequestCount_TotalCount_value_changed.callCount.should.eql(1);
            useTwoLevelsDeep && uaVariable.totalRequestCount.totalCount.readValue().value.value.should.eql(1);
        });
    });

    describe("should be possible to bind an Extension Object properties with variable node properties", () => {
        let _sessionDiagnostics: any;
        let sessionDiagnostics: any;

        let spy_on_sessionDiagnostics_value_changed: any;
        let spy_on_sessionDiagnostics_totalRequestCount_value_changed: any;
        let spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed: any;
        let spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed: any;
        let spy_on_sessionDiagnostics_clientDescription_value_changed: any;

        let counter = 0;

        beforeEach(() => {
            const rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            const sessionDiagnosticsDataType = addressSpace.findDataType("SessionDiagnosticsDataType")!;
            const sessionDiagnosticsVariableType = addressSpace.findVariableType("SessionDiagnosticsVariableType")!;

            // the extension object
            // xx _sessionDiagnostics = addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});

            counter += 1;
            sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                browseName: "SessionDiagnostics" + counter,
                organizedBy: rootFolder.objects
            }) as UASessionDiagnosticsVariable<DTSessionDiagnostics>;

            _sessionDiagnostics = sessionDiagnostics.bindExtensionObject();
            assert(sessionDiagnostics.$extensionObject === _sessionDiagnostics);
            sessionDiagnostics.installExtensionObjectVariables();

            // xx console.log(_sessionDiagnostics.toString());

            // lets verify source timestamp has been set properly
            should.exist(sessionDiagnostics.readValue().sourceTimestamp);
            should.exist(sessionDiagnostics.readValue().serverTimestamp);
            // xx console.log(sessionDiagnostics.readValue().toString());

            sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(0);
            sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(0);
            sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(0);

            sessionDiagnostics.totalRequestCount.errorCount.readValue().value.value.should.eql(0);
            sessionDiagnostics.totalRequestCount.readValue().value.value.errorCount.should.eql(0);
            sessionDiagnostics.readValue().value.value.totalRequestCount.errorCount.should.eql(0);

            // install spies
            spy_on_sessionDiagnostics_value_changed = sinon.spy();
            spy_on_sessionDiagnostics_clientDescription_value_changed = sinon.spy();
            spy_on_sessionDiagnostics_totalRequestCount_value_changed = sinon.spy();
            spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed = sinon.spy();
            spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed = sinon.spy();

            sessionDiagnostics.on("value_changed", spy_on_sessionDiagnostics_value_changed);
            sessionDiagnostics.clientDescription.on("value_changed", spy_on_sessionDiagnostics_clientDescription_value_changed);
            sessionDiagnostics.totalRequestCount.on("value_changed", spy_on_sessionDiagnostics_totalRequestCount_value_changed);
            sessionDiagnostics.totalRequestCount.totalCount.on(
                "value_changed",
                spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed
            );
            sessionDiagnostics.totalRequestCount.errorCount.on(
                "value_changed",
                spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed
            );
        });

        it("ZA1- a ExtensionObject variable should have the expected dataType node", () => {
            const dataTypeNode = sessionDiagnostics.getDataTypeNode();

            dataTypeNode.browseName.toString().should.eql("SessionDiagnosticsDataType");
            const structure = addressSpace.findDataType("Structure");
            dataTypeNode.isSubtypeOf(structure).should.eql(true);

            const definition = dataTypeNode.getStructureDefinition();
            definition.fields
                .map((x: any) => x.name)
                .sort()
                .should.eql([
                    "ActualSessionTimeout",
                    "AddNodesCount",
                    "AddReferencesCount",
                    "BrowseCount",
                    "BrowseNextCount",
                    "CallCount",
                    "ClientConnectionTime",
                    "ClientDescription",
                    "ClientLastContactTime",
                    "CreateMonitoredItemsCount",
                    "CreateSubscriptionCount",
                    "CurrentMonitoredItemsCount",
                    "CurrentPublishRequestsInQueue",
                    "CurrentSubscriptionsCount",
                    "DeleteMonitoredItemsCount",
                    "DeleteNodesCount",
                    "DeleteReferencesCount",
                    "DeleteSubscriptionsCount",
                    "EndpointUrl",
                    "HistoryReadCount",
                    "HistoryUpdateCount",
                    "LocaleIds",
                    "MaxResponseMessageSize",
                    "ModifyMonitoredItemsCount",
                    "ModifySubscriptionCount",
                    "PublishCount",
                    "QueryFirstCount",
                    "QueryNextCount",
                    "ReadCount",
                    "RegisterNodesCount",
                    "RepublishCount",
                    "ServerUri",
                    "SessionId",
                    "SessionName",
                    "SetMonitoringModeCount",
                    "SetPublishingModeCount",
                    "SetTriggeringCount",
                    "TotalRequestCount",
                    "TransferSubscriptionsCount",
                    "TranslateBrowsePathsToNodeIdsCount",
                    "UnauthorizedRequestCount",
                    "UnregisterNodesCount",
                    "WriteCount"
                ]);
        });

        it("ZA2- sessionDiagnostics should have a dataValue with the expected ExtensionObjectType", () => {
            const extensionObject = sessionDiagnostics.readValue().value.value;
            extensionObject.constructor.name.should.eql("SessionDiagnosticsDataType");
        });

        it(
            "ZA3- updateExtensionObjectPartial: it should be possible to cascade changes " +
            "by acting on the whole ExtensionObject",
            () => {
                spy_on_sessionDiagnostics_clientDescription_value_changed.callCount.should.eql(0);

                const someClientDescription = /* new ApplicationDescription( */ {
                    /* ApplicationDescription */
                    applicationUri: "applicationUri-1"
                }; /*)*/

                sessionDiagnostics.updateExtensionObjectPartial({ clientDescription: someClientDescription });

                spy_on_sessionDiagnostics_clientDescription_value_changed.callCount.should.eql(1);
                spy_on_sessionDiagnostics_value_changed.callCount.should.eql(1);

                sessionDiagnostics.clientDescription.applicationUri.readValue().value.value.should.eql("applicationUri-1");
                sessionDiagnostics.clientDescription.readValue().value.value.applicationUri.should.eql("applicationUri-1");
                sessionDiagnostics.readValue().value.value.clientDescription.applicationUri.should.eql("applicationUri-1");

                _sessionDiagnostics.clientDescription.applicationUri.should.eql("applicationUri-1");

                spy_on_sessionDiagnostics_totalRequestCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed.callCount.should.eql(0);

                const eo = sessionDiagnostics.readValue().value.value;
                eo.clientDescription.applicationUri.should.eql("applicationUri-1");

                // xx console.log(eo.toString());
            }
        );

        it(
            "ZA4- updateExtensionObjectPartial: it should be possible to cascade changes " +
            "by acting on the whole ExtensionObject - middle",
            () => {
                spy_on_sessionDiagnostics_totalRequestCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed.callCount.should.eql(0);

                sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(0);
                sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(0);
                sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(0);
                _sessionDiagnostics.totalRequestCount.totalCount.should.eql(0);

                const totalRequestCount = /* new Counter( */ {
                    errorCount: 25,
                    totalCount: 130
                };
                sessionDiagnostics.updateExtensionObjectPartial({ totalRequestCount });

                sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(130);
                sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(130);
                sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(130);
                _sessionDiagnostics.totalRequestCount.totalCount.should.eql(130);

                sessionDiagnostics.totalRequestCount.errorCount.readValue().value.value.should.eql(25);
                sessionDiagnostics.totalRequestCount.readValue().value.value.errorCount.should.eql(25);
                sessionDiagnostics.readValue().value.value.totalRequestCount.errorCount.should.eql(25);
                _sessionDiagnostics.totalRequestCount.errorCount.should.eql(25);
            }
        );

        it(
            "ZA5- incrementExtensionObjectPartial: it should be possible to cascade changes " +
            "by increasing a value on ExtensionObject",
            () => {
                sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(0);
                sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(0);
                sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(0);
                _sessionDiagnostics.totalRequestCount.totalCount.should.eql(0);

                spy_on_sessionDiagnostics_totalRequestCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed.callCount.should.eql(0);

                sessionDiagnostics.incrementExtensionObjectPartial("totalRequestCount.totalCount");

                sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(1);
                sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(1);
                sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(1);
                _sessionDiagnostics.totalRequestCount.totalCount.should.eql(1);

                sessionDiagnostics.incrementExtensionObjectPartial("totalRequestCount.totalCount");

                sessionDiagnostics.totalRequestCount.totalCount.readValue().value.value.should.eql(2);
                sessionDiagnostics.totalRequestCount.readValue().value.value.totalCount.should.eql(2);
                sessionDiagnostics.readValue().value.value.totalRequestCount.totalCount.should.eql(2);
                _sessionDiagnostics.totalRequestCount.totalCount.should.eql(2);

                spy_on_sessionDiagnostics_totalRequestCount_value_changed.callCount.should.eql(2);
                spy_on_sessionDiagnostics_totalRequestCount_errorCount_value_changed.callCount.should.eql(0);
                spy_on_sessionDiagnostics_totalRequestCount_totalCount_value_changed.callCount.should.eql(2);
            }
        );

        it(
            "ZA6- changing property values in extension object directly should propagates changes and notification " +
            "to NodeVariables",
            () => {
                _sessionDiagnostics.clientDescription.applicationUri = "applicationUri-1";

                sessionDiagnostics.clientDescription.applicationUri.readValue().value.value.should.eql("applicationUri-1");
                sessionDiagnostics.clientDescription.readValue().value.value.applicationUri.should.eql("applicationUri-1");
                sessionDiagnostics.readValue().value.value.clientDescription.applicationUri.should.eql("applicationUri-1");
            }
        );
    });
});

// tslint:disable-next-line: no-empty-interface
interface UAMeasIdDataType extends UAVariable { }
// tslint:disable-next-line: no-empty-interface
interface UAPartIdDataType extends UAVariable {
    id: UAVariableT<string, DataType.String>;
    $description: UAVariableT<LocalizedText, DataType.LocalizedText>;
}
interface UAResultIdDataType extends UAVariable {
    id: UAVariableT<string, DataType.String>;
}
interface UAConfigurationId extends UAVariable {
    id: UAVariableT<string, DataType.String>;
    version: UAVariableT<string, DataType.String>;
    hash: UAVariableT<Buffer, DataType.ByteString>;
}
interface UAResultType extends UAVariable {
    resultId: UAResultIdDataType;
    hasTransferableDataOnFile?: UAVariableT<boolean, DataType.Boolean>; // Opt
    isPartial: UAVariableT<boolean, DataType.Boolean>;
    isSimulated: UAVariableT<boolean, DataType.Boolean>; // Opt
    resultState: UAVariableT<number, DataType.Int32>;
    measId: UAMeasIdDataType;
    partId: UAPartIdDataType;
    internalConfigurationId: UAConfigurationId;
    resultContent: UAVariable;
}
describe("Extension Object binding and sub  components On MachineVision", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        const nodesetFilename = [nodesets.standard, nodesets.machineVision];
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("private");
        await generateAddressSpace(addressSpace, nodesetFilename);
    });
    after(async () => {
        addressSpace.dispose();
    });

    let nsMV = 0;
    let resultDataType: UADataType;
    let resultType: UAVariableType;
    beforeEach(() => {
        nsMV = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineVision");
        if (nsMV <= 0) {
            throw new Error("Cannot find MachineVision namespace");
        }
        resultDataType = addressSpace.findDataType("ResultDataType", nsMV)!;

        resultType = addressSpace.findVariableType("ResultType", nsMV)! as UAVariableType;
        if (!resultType) {
            throw new Error("Cannot find ResultType");
        }
    });
    it("MV1 MachineVision-BindExtensionObject should instantiate a ResultType", () => {
        const result = resultType.instantiate({
            browseName: `Result`,
            organizedBy: addressSpace.rootFolder.objects
        });
        const extObj = result.bindExtensionObject();
        if (doDebug) {
            console.log(extObj?.toString());
        }
    });
    it("MV2 MachineVision-BindExtensionObject should instantiate a ResultType", () => {
        const partIdDataType = addressSpace.findDataType("PartIdDataType", nsMV)!;
        const partId = addressSpace.constructExtensionObject(partIdDataType, {
            description: "World",
            id: "Hello"
        });

        const configurationIdDataType = addressSpace.findDataType("ConfigurationIdDataType", nsMV)!;
        const rr = addressSpace.constructExtensionObject(configurationIdDataType, {
            description: "some description",
            hash: Buffer.from("DEADBEEF", "hex"),
            id: "IIII",
            version: "1.2"
        });
        should.exist((<any>rr).hash);
        (<any>rr).hash.toString("hex").should.eql("deadbeef");

        const recipeIdExternalD = addressSpace.findDataType("RecipeIdExternalDataType", nsMV)!;

        const a = addressSpace.constructExtensionObject(recipeIdExternalD, {});
        const extObj = addressSpace.constructExtensionObject(resultDataType, {
            hasTransferableDataOnFile: true,
            internalConfigurationId: {
                description: "some description",
                hash: Buffer.from("DEADBEEF", "hex"),
                id: "IIII",
                version: "1.2"
            },
            partId,
            resultState: 32,

            resultContent: [{ dataType: DataType.ExtensionObject, value: a }]
        });
        if (doDebug) {
            console.log("extObj", extObj.toString());
        }
        should.exist((<any>extObj).internalConfigurationId.hash);
        (<any>extObj).internalConfigurationId.hash.toString("hex").should.eql("deadbeef");

        const result = resultType.instantiate({
            browseName: `Result2`,
            organizedBy: addressSpace.rootFolder.objects,
            value: {
                dataType: DataType.ExtensionObject,
                value: extObj
            }
        }) as UAResultType;

        const verif = result.readValue().value.value as any;
        should.exist(verif.internalConfigurationId.hash);
        verif.internalConfigurationId.hash.toString("hex").should.eql("deadbeef");

        if (doDebug) {
            console.log(result.readValue().value.value.toString());
            console.log(result.toString());
            console.log(result.internalConfigurationId.toString());
        }

        const dataValue = result.internalConfigurationId.readValue();
        const _internalConfigurationId = dataValue.value.value;
        _internalConfigurationId.hash.toString("hex").should.eql("deadbeef");
        if (doDebug) {
            console.log("Hash =", result.internalConfigurationId.readValue().value.value.toString("hex"));
        }
        dataValue.statusCode.should.eql(StatusCodes.Good);
    });
});
