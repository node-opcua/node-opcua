const chalk = require("chalk");
const { assert } = require("node-opcua-assert");

const { OPCUAClient, nodesets, AddressSpace, makeBrowsePath, periodicClockAdjustment, AttributeIds } = require("node-opcua");
const { build_address_space_for_conformance_testing } = require("node-opcua-address-space-for-conformance-testing");
const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");
const { start_simple_server, stop_simple_server } = require("../../test_helpers/external_server_fixture");

async function start_external_server(test, options) {
    assert(typeof test.port === "number");

    options.silent = true;

    const data = await start_simple_server(options);
    test.endpointUrl = data.endpointUrl;
    test.serverCertificate = data.serverCertificate;
    test.temperatureVariableId = data.temperatureVariableId;
    test.data;
    console.log(chalk.yellow(" test.endpointUrl  = "), test.endpointUrl);
}

async function start_internal_server(test, options) {
    console.log(options);

    test.server = await build_server_with_temperature_device(options);

    test.server.engine.addressSpace.should.be.instanceOf(AddressSpace);

    await build_address_space_for_conformance_testing(test.server.engine.addressSpace, { mass_variables: false });

    test.endpointUrl = test.server.getEndpointUrl();
    test.temperatureVariableId = test.server.temperatureVariableId;

    await new Promise((resolve) => {
        setTimeout(function () {
            test.server.engine.currentSessionCount.should.eql(0, " expecting ZERO session on server when test is starting !");
            console.log(" ..... done ");
            console.log("server started at ", test.endpointUrl);
            resolve();
        }, 500);
    });
}

async function dumpStatistics(endpointUrl) {
    const client = OPCUAClient.create();

    await client.withSessionAsync(endpointUrl, async (session) => {
        const relativePath = "/Objects/Server.ServerDiagnostics.ServerDiagnosticsSummary";
        const browsePath = [makeBrowsePath("RootFolder", relativePath)];

        let sessionDiagnosticsSummaryNodeId;
        const result = await session.translateBrowsePath(browsePath);
        if (result[0].statusCode.isGood()) {
            //xx console.log(result[0].toString());
            sessionDiagnosticsSummaryNodeId = result[0].targets[0].targetId;
        } else {
            throw new Error("Cannot find ServerDiagnosticsSummary");
        }
        const dataValue = await session.read({ nodeId: sessionDiagnosticsSummaryNodeId, attributeId: AttributeIds.Value });
        console.log(
            "\n\n-----------------------------------------------------------------------------------------------------------"
        );
        console.log(dataValue.value.value.toString());
        console.log("-----------------------------------------------------------------------------------------------------------");
    });
}

exports.afterTest = async function afterTest(test) {
    if (test.data) {
        await stop_simple_server(test.data);
    } else if (test.server) {
        await test.server.shutdown();
        if (periodicClockAdjustment.timerInstallationCount !== 0) {
            console.log("!!!!!!!!!!!!!!!!!!! -- " + "periodicClockAdjustment call are not matching....");
            // periodicClockAdjustment.timerInstallationCount.should.eql(0, "periodicClockAdjustment call are not matching....");
        }
    }
};

exports.beforeTest = async function beforeTest(test) {
    test.backgroundSessionCount = 0;
    test.backgroundSubscriptionCount = 0;

    const options = {
        port: test.port,
        maxConnectionsPerEndpoint: 500,
        silent: true,
        nodeset_filename: [nodesets.standard]
    };

    console.log(
        chalk.bgWhite.red(
            " ..... starting server " +
                test.port.toString() +
                "                                                                                                        ."
        )
    );
    if (process.env.TESTENDPOINT === "EXTERNAL") {
        await start_external_server(test, options);
    } else if (process.env.TESTENDPOINT) {
        test.endpointUrl = process.env.TESTENDPOINT;
    } else {
        await start_internal_server(test, options);
    }
};

exports.beforeEachTest = async function beforeEachTest(test) {
    // make sure that test has closed all sessions
    if (test.server) {
        test.server.engine.currentSessionCount.should.eql(
            test.backgroundSessionCount,
            " expecting ZERO session on server when test is starting ! got " + test.server.engine.currentSessionCount
        );

        test.server.engine.currentSubscriptionCount.should.eql(
            test.backgroundSubscriptionCount,
            " expecting ZERO subscription on server when test is starting ! got " + test.server.engine.currentSubscriptionCount
        );
    }
};

exports.afterEachTest = async function afterEachTest(test) {
    const extraSessionCount = test.server.engine.currentSessionCount !== test.backgroundSessionCount;

    const extraSubscriptionCount = test.server.engine.currentSubscriptionCount !== test.backgroundSubscriptionCount;

    if ((extraSessionCount || extraSubscriptionCount) && test.server) {
        await dumpStatistics(test.endpointUrl);

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
        // test must not add  some extra nodes in root => "organizes" ref count => 3
        const addressSpace = test.server.engine.addressSpace;
        const rootFolder = addressSpace.findNode("RootFolder");
        rootFolder
            .getFolderElements()
            .length.should.eql(3, "Test should not pollute the root folder: expecting 3 folders in RootFolder only");
    }

    // make sure that test has closed all sessions
    test.server.engine.currentSessionCount.should.eql(test.backgroundSessionCount, " Test must have deleted all created session");
    test.server.engine.currentSubscriptionCount.should.eql(
        test.backgroundSubscriptionCount,
        " Test must have deleted all created subscriptions"
    );
};
