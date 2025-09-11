import chalk from "chalk";
import { assert } from "node-opcua-assert";
import "should";
import {
    OPCUAClient,
    nodesets,
    AddressSpace,
    makeBrowsePath,
    periodicClockAdjustment,
    AttributeIds
} from "node-opcua";
import { build_address_space_for_conformance_testing } from "node-opcua-address-space-for-conformance-testing";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { start_simple_server, stop_simple_server } from "../../test_helpers/external_server_fixture";

// Shape used by umbrella tests (they pass 'this' mocha context)
export interface UmbrellaTestContext extends Mocha.Context {
    port: number;
    endpointUrl?: string;
    server?: any; // OPCUAServer like
    serverCertificate?: Buffer;
    temperatureVariableId?: any;
    data?: any; // external server data
    backgroundSessionCount?: number;
    backgroundSubscriptionCount?: number;
}

interface ExternalServerData {
    endpointUrl: string;
    serverCertificate: Buffer;
    temperatureVariableId: any;
}

async function start_external_server(test: UmbrellaTestContext, options: any) {
    assert(typeof test.port === "number");
    options.silent = true;
    const data = (await start_simple_server(options)) as ExternalServerData;
    test.endpointUrl = data.endpointUrl;
    (test as any).serverCertificate = data.serverCertificate;
    (test as any).temperatureVariableId = data.temperatureVariableId;
    (test as any).data = data as ExternalServerData;
    console.log(chalk.yellow(" test.endpointUrl  = "), test.endpointUrl);
}

async function start_internal_server(test: UmbrellaTestContext, options: any) {
    console.log(options);
    test.server = await build_server_with_temperature_device(options);
    test.server.engine.addressSpace.should.be.instanceOf(AddressSpace);
    await build_address_space_for_conformance_testing(test.server.engine.addressSpace, { mass_variables: false });
    test.endpointUrl = test.server.getEndpointUrl();
    (test as any).temperatureVariableId = test.server.temperatureVariableId;
    await new Promise<void>((resolve) => {
        setTimeout(() => {
            test.server.engine.currentSessionCount.should.eql(0, " expecting ZERO session on server when test is starting !");
            console.log(" ..... done ");
            console.log("server started at ", test.endpointUrl);
            resolve();
        }, 500);
    });
}

async function dumpStatistics(endpointUrl: string) {
    const client = OPCUAClient.create({});
    await client.withSessionAsync(endpointUrl, async (session) => {
        const relativePath = "/Objects/Server.ServerDiagnostics.ServerDiagnosticsSummary";
        const browsePath = [makeBrowsePath("RootFolder", relativePath)];
        const result = await session.translateBrowsePath(browsePath);
        let sessionDiagnosticsSummaryNodeId;
        if (result[0].statusCode.isGood() && result[0].targets && result[0].targets[0]) {
            sessionDiagnosticsSummaryNodeId = result[0].targets[0]!.targetId;
        } else {
            throw new Error("Cannot find ServerDiagnosticsSummary");
        }
        const dataValue = await session.read({ nodeId: sessionDiagnosticsSummaryNodeId, attributeId: AttributeIds.Value });
        console.log("\n\n-----------------------------------------------------------------------------------------------------------");
        console.log(dataValue.value.value.toString());
        console.log("-----------------------------------------------------------------------------------------------------------");
    });
}

export async function afterTest(test: UmbrellaTestContext) {
    if ((test as any).data) {
        await stop_simple_server((test as any).data);
    } else if (test.server) {
        await test.server.shutdown();
        if ((periodicClockAdjustment as any).timerInstallationCount !== 0) {
            console.log("!!!!!!!!!!!!!!!!!!! -- periodicClockAdjustment call are not matching....");
            // left as log only (original test tolerated mismatch)
        }
    }
}

export async function beforeTest(test: UmbrellaTestContext) {
    test.backgroundSessionCount = 0;
    test.backgroundSubscriptionCount = 0;
    const options = {
        port: test.port,
        maxConnectionsPerEndpoint: 500,
        silent: true,
        nodeset_filename: [nodesets.standard],
        serverCapabilities: { operationLimits: {} }
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
}

export async function beforeEachTest(test: UmbrellaTestContext) {
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
}

export async function afterEachTest(test: UmbrellaTestContext) {
    if (!test.server) return;
    const extraSessionCount = test.server.engine.currentSessionCount !== test.backgroundSessionCount;
    const extraSubscriptionCount = test.server.engine.currentSubscriptionCount !== test.backgroundSubscriptionCount;
    if (extraSessionCount || extraSubscriptionCount) {
        await dumpStatistics(test.endpointUrl!);
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
        const rootFolder = addressSpace.findNode("RootFolder");
        rootFolder
            .getFolderElements()
            .length.should.eql(3, "Test should not pollute the root folder: expecting 3 folders in RootFolder only");
    }
    test.server.engine.currentSessionCount.should.eql(
        test.backgroundSessionCount,
        " Test must have deleted all created session"
    );
    test.server.engine.currentSubscriptionCount.should.eql(
        test.backgroundSubscriptionCount,
        " Test must have deleted all created subscriptions"
    );
}
