import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { AttributeIds } from "node-opcua-data-model";
import { EndpointConfiguration, ServerDiagnosticsSummaryDataType, ServiceCounterDataType } from "node-opcua-types";

import { AddressSpace, UAObject, SessionContext } from "..";
import { generateAddressSpace } from "../nodeJS";
import { UAVariable } from "..";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#1132 Variable  ExtensionObject containing NodeId in nodeset2.xml", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            path.join(__dirname, "../test_helpers/test_fixtures/issue_1132_variable_with_nodeid_value.xml")
        ]);
    });

    after(() => {
        addressSpace.dispose();
    });
    it("should load a extension object containing a NodeId field", ()=>{
        const ns = addressSpace.getNamespaceIndex("http://mynamespace");
        const v = addressSpace.findNode(`ns=${ns};i=1272`) as UAVariable;
        console.log(v.readValue().value.value.toJSON() );
        v.readValue().value.value.toJSON().should.eql({
            sessionId: 'ns=1;g=7BC32991-2103-2344-DE12-84ED18A855B4',
            subscriptionId: 869582,
            priority: 0,
            publishingInterval: 100,
            maxKeepAliveCount: 50,
            maxLifetimeCount: 12000,
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            modifyCount: 0,
            enableCount: 0,
            disableCount: 0,
            republishRequestCount: 1,
            republishMessageRequestCount: 1,
            republishMessageCount: 0,
            transferRequestCount: 0,
            transferredToAltClientCount: 0,
            transferredToSameClientCount: 0,
            publishRequestCount: 0,
            dataChangeNotificationsCount: 0,
            eventNotificationsCount: 0,
            notificationsCount: 0,
            latePublishRequestCount: 0,
            currentKeepAliveCount: 0,
            currentLifetimeCount: 0,
            unacknowledgedMessageCount: 0,
            discardedMessageCount: 0,
            monitoredItemCount: 1,
            disabledMonitoredItemCount: 0,
            monitoringQueueOverflowCount: 0,
            nextSequenceNumber: 1,
            eventQueueOverFlowCount: 0
          });
    });
});

