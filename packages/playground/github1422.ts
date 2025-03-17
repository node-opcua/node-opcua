#!/usr/bin/env tsx
import {
  OPCUAClient,
} from "node-opcua-client";

async function main(): Promise<void> {

  const client = OPCUAClient.create({
    endpointMustExist: false,
    // requestedSessionTimeout: 3 * 1000,
    // tokenRenewalInterval: 10* 1000,
    // defaultSecureTokenLifetime: 10*1000
  });

  const endpointUrl = "opc.tcp://localhost:4840/";

  const subscriptionParamters = {
    requestedPublishingInterval: 1000,
    maxNotificationsPerPublish: 100,
    publishingEnabled: true,
    priority: 10,
  };

  await client.withSubscriptionAsync(endpointUrl, subscriptionParamters, async (session, subscription) => {



      console.log("CTRL+C to stop");
      await new Promise<void>((resolve) => process.once("SIGINT", resolve));

    }
  );
}
main();
