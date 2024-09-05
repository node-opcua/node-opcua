# node-opcua-server-configuration

an implementation of an OPC UA stack fully written in javascript and nodejs

see http://node-opcua.github.io/

an implementation of ServerConfiguration object inside node-opcua servers

```javascript
import { OPCUAClient, NodeId } from "node-opcua-client";
import { node-opcua-server-configuration } from "node-opcua-server-configuration";

const client = OPCUAClient.create({
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256,
});
await client.withSessionAsync({
   endpointUrl: "opc.tcp://localhost:4840",
   userIdentityToken: {
        type: UserTokenType.UserName,
        userName: "admin",
        password: process.env.ADMIN_PASSWORD
   };
}, async session() {

    const pushCertificateSession = new ClientPushCertificateManagement(session);
  
    // get a certificate signing request from the OPCUA server
    const response = await pm.createSigningRequest(
        "DefaultApplicationGroup", NodeId.nullNodeId, "CN=MyApplication");

  
    // call your own CA to sign the certificate
    const certificateFull = await produceCertificate(response.certificateSigningRequest);

    // now update the certificate of the server
    const response2 = await pushCertificateSession.updateCertificate(
        "DefaultApplicationGroup",
         NodeId.nullNodeId,
         certificate,
         issuerCertificates
    );
    // apply the new certificate
    await pushCertificateSession.applyChanges();

});
```
