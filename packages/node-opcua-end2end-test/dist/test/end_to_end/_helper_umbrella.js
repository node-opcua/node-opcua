import chalk from "chalk";
import { AttributeIds, makeBrowsePath, nodesets, OPCUAClient, periodicClockAdjustment } from "node-opcua";
import { build_address_space_for_conformance_testing } from "node-opcua-address-space-for-conformance-testing";
import { assert } from "node-opcua-assert";
import should from "should";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device.js";
import { start_simple_server, stop_simple_server } from "../../test_helpers/external_server_fixture.js";
async function start_external_server(test, options) {
    assert(typeof test.port === "number");
    options.silent = true;
    const serverHandle = await start_simple_server(options);
    test.endpointUrl = serverHandle.endpointUrl;
    test.serverCertificate = serverHandle.serverCertificate;
    test.data = serverHandle;
    console.log(chalk.yellow(" test.endpointUrl  = "), test.endpointUrl);
}
async function start_internal_server(test, options) {
    test.server = await build_server_with_temperature_device(options);
    // asserts that there is one, not which class it is: AddressSpace is published as an
    // interface plus a factory, and does not expose a constructor to check against
    if (!test.server.engine.addressSpace) {
        throw new Error("AddressSpace not found");
    }
    await build_address_space_for_conformance_testing(test.server.engine.addressSpace, { mass_variables: false });
    test.endpointUrl = test.server.getEndpointUrl();
    await new Promise((resolve) => {
        setTimeout(() => {
            should(test.server?.engine.currentSessionCount).eql(0, " expecting ZERO session on server when test is starting !");
            console.log(" ..... done ");
            console.log("server started at ", test.endpointUrl);
            resolve();
        }, 500);
    });
}
async function dumpStatistics(endpointUrl) {
    const client = OPCUAClient.create({});
    await client.withSessionAsync(endpointUrl, async (session) => {
        const relativePath = "/Objects/Server.ServerDiagnostics.ServerDiagnosticsSummary";
        const browsePath = [makeBrowsePath("RootFolder", relativePath)];
        const result = await session.translateBrowsePath(browsePath);
        let sessionDiagnosticsSummaryNodeId;
        if (result[0].statusCode.isGood() && result[0].targets?.[0]) {
            sessionDiagnosticsSummaryNodeId = result[0].targets[0]?.targetId;
        }
        else {
            throw new Error("Cannot find ServerDiagnosticsSummary");
        }
        const dataValue = await session.read({ nodeId: sessionDiagnosticsSummaryNodeId, attributeId: AttributeIds.Value });
        console.log("\n\n-----------------------------------------------------------------------------------------------------------");
        console.log(dataValue.value.value.toString());
        console.log("-----------------------------------------------------------------------------------------------------------");
    });
}
export async function afterTest(test) {
    if (test.data) {
        await stop_simple_server(test.data);
    }
    else if (test.server) {
        await test.server.shutdown();
        if (periodicClockAdjustment.timerInstallationCount !== 0) {
            console.log("!!!!!!!!!!!!!!!!!!! -- periodicClockAdjustment call are not matching....");
            // left as log only (original test tolerated mismatch)
        }
    }
    // Restore original auto-accept setting
    // @ts-ignore - access custom property
    const originalEnv = test._originalAutoAccept;
    if (originalEnv !== undefined) {
        process.env.NODE_OPCUA_AUTO_ACCEPT_CERTS = originalEnv;
    }
    else {
        delete process.env.NODE_OPCUA_AUTO_ACCEPT_CERTS;
    }
}
export async function beforeTest(test) {
    test.backgroundSessionCount = 0;
    test.backgroundSubscriptionCount = 0;
    // Enable auto-accept for default certificate manager to maintain compatibility
    // with self-signed certificates in tests
    const originalEnv = process.env.NODE_OPCUA_AUTO_ACCEPT_CERTS;
    process.env.NODE_OPCUA_AUTO_ACCEPT_CERTS = "true";
    // @ts-ignore - add custom property to store original value
    test._originalAutoAccept = originalEnv;
    const options = {
        port: test.port ? parseInt(test.port.toString(), 10) : 26543,
        maxConnectionsPerEndpoint: 500,
        silent: true,
        nodeset_filename: [nodesets.standard],
        serverCapabilities: {
            // the client is bare and does not batch on the advertised limits (that is the
            // optimized client, sterfive/optimized-client, territory): the umbrella tests
            // monitor ~5000 nodes in one call, so the server must allow that
            operationLimits: { maxMonitoredItemsPerCall: 10000 }
        },
        // the umbrella suites exercise the transfer mechanics (TSS, SubscriptionDiagnostics-5, 195-B)
        // with anonymous clients over a None endpoint, which Part 4 5.13.7 refuses by default: keep the
        // pre-2.183 relaxation here; the rule itself is covered by
        // test_e2e_transfer_subscription_anonymous_secured_channel.ts
        allowAnonymousSubscriptionTransferOnUnsecuredChannel: true,
        server_sourcefile: ""
    };
    console.log(chalk.bgWhite.red(" ..... starting server " +
        test.port?.toString() +
        "                                                                                                        ."));
    if (process.env.TESTENDPOINT === "EXTERNAL") {
        await start_external_server(test, options);
    }
    else if (process.env.TESTENDPOINT) {
        test.endpointUrl = process.env.TESTENDPOINT;
    }
    else {
        await start_internal_server(test, options);
    }
}
export async function beforeEachTest(test) {
    if (test.server) {
        test.server.engine.currentSessionCount.should.eql(test.backgroundSessionCount, ` expecting ZERO session on server when test is starting ! got ${test.server.engine.currentSessionCount}`);
        test.server.engine.currentSubscriptionCount.should.eql(test.backgroundSubscriptionCount, ` expecting ZERO subscription on server when test is starting ! got ${test.server.engine.currentSubscriptionCount}`);
    }
}
export async function afterEachTest(test) {
    if (!test.server)
        return;
    const extraSessionCount = test.server.engine.currentSessionCount !== test.backgroundSessionCount;
    const extraSubscriptionCount = test.server.engine.currentSubscriptionCount !== test.backgroundSubscriptionCount;
    if (extraSessionCount || extraSubscriptionCount) {
        await dumpStatistics(test.endpointUrl || "");
        console.log(" currentChannelCount          = ", test.server.currentChannelCount);
        console.log(" bytesWritten                 = ", test.server.bytesWritten);
        console.log(" bytesRead                    = ", test.server.bytesRead);
        console.log(" currentSubscriptionCount     = ", test.server.currentSubscriptionCount);
        console.log(" currentSessionCount          = ", test.server.currentSessionCount);
        console.log(" transactionsCount            = ", test.server.transactionsCount);
        console.log(" cumulatedSessionCount        = ", test.server.engine.cumulatedSessionCount);
        console.log(" cumulatedSubscriptionCount   = ", test.server.engine.cumulatedSubscriptionCount);
        console.log(" rejectedSessionCount         = ", test.server.engine.rejectedSessionCount);
        test.server.currentSubscriptionCount.should.eql(0, " verify test clean up : dangling  subscriptions found");
        test.server.currentSessionCount.should.eql(0, " verify test clean up : dangling  session found on server");
        const addressSpace = test.server.engine.addressSpace;
        if (addressSpace) {
            const rootFolder = addressSpace.findNode("RootFolder");
            should(rootFolder).not.be.null();
            should(rootFolder?.findReferencesEx("Organizes").length).eql(3, "Test should not pollute the root folder: expecting 3 folders in RootFolder only");
        }
    }
    test.server.engine.currentSessionCount.should.eql(test.backgroundSessionCount, " Test must have deleted all created session");
    test.server.engine.currentSubscriptionCount.should.eql(test.backgroundSubscriptionCount, " Test must have deleted all created subscriptions");
}
//# sourceMappingURL=_helper_umbrella.js.map