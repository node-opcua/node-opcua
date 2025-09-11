import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";

import { AddressSpace, instantiateCertificateExpirationAlarm } from "../..";
import { generateAddressSpace } from "../../nodeJS";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const fakeCertificate = Buffer.from(
    `
MIIEMzCCAxugAwIBAgIJALb/0j7pUI8cMA0GCSqGSIb3DQEBCwUAMFUxCzAJBgNVBAYTAkZSMRAwDgYD
VQQHDAdPcmxlYW5zMREwDwYDVQQKDAhTdGVyZml2ZTEhMB8GA1UEAwwYRE5BLU9QQ1VBLUNsaWVudEBI
N1E4UTEzMB4XDTIyMDgyOTE0MzMxNVoXDTMyMDgyNjE0MzMxNVowVTELMAkGA1UEBhMCRlIxEDAOBgNV
BAcMB09ybGVhbnMxETAPBgNVBAoMCFN0ZXJmaXZlMSEwHwYDVQQDDBhETkEtT1BDVUEtQ2xpZW50QEg3
UThRMTMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC0Z88FBZX1QfGHKbfWeekw6nogPX1L
vqBSGmxoe7bnIx3X8GPfVl908tptka66v+fXKyY0rdF+t4e5NZq4DqHJ08geMY/xTXtLNDQI1FOAk6pM
+k7kTEb7H7ZY5UgKqhjWltm9Vn4XKf5hLPSm8lsQU6T6PQCHF6eu/MZq8fIkCfd6s5VXZfXeGYXaFK0x
WajIav2iXq8fDDwVJ6lTiBbzxa2EbCsjCras1HgvEN0xYmHj0PBkB8U8Q33ium+m5Pm/D+9TW7I+/pVt
yw0uY714yLkFBUKB8rcoGyPTtXdOBuqV22XcWMggrl2lTo3IS0u/MKV/QzYb23i4b/UxP2UdAgMBAAGj
ggEEMIIBADAdBgNVHQ4EFgQUiqf6W9s8nIEUA9gJShQTRvW2OmUwHwYDVR0jBBgwFoAUiqf6W9s8nIEU
A9gJShQTRvW2OmUwDAYDVR0TAQH/BAIwADALBgNVHQ8EBAMCAvQwHQYDVR0lBBYwFAYIKwYBBQUHAwIG
CCsGAQUFBwMBMFIGCWCGSAGG+EIBDQRFFkNTZWxmLXNpZ25lZCBjZXJ0aWZpY2F0ZSBnZW5lcmF0ZWQg
YnkgTm9kZS1PUENVQSBDZXJ0aWZpY2F0ZSB1dGlsaXR5MDAGA1UdEQQpMCeGHHVybjpIN1E4UTEzOkRO
QS1PUENVQS1DbGllbnSCB0g3UThRMTMwDQYJKoZIhvcNAQELBQADggEBAH5gi1AjHPy8N7jjHgm72hiC
kUk3999k/u/KQRi+QmLtcFdWUZlHBEITfwzUz0IKOlmxBKSvNOgvWKjIO9My/syctJNqM8X0Rl/svoI7
mn7iCN1rRi7pg7Bf0/0Zuhqg++cjlsc285lZxv97d9h5FBnwxDPRUss8PXmBjTpcfZ/7a9t2NYolE65Z
nun0uZmiRU+J7DVJCYsKHzOe8jaNU9ZStIMgWB8D5OojXhmZjzsyx5iqXJ+vPyHIGcvZ5mqwuxT46PEO
kOq1pKDyP0LV49z6UeDJ/ScVaMAAylHEsV7jus+8sgJQMvDYBhPCmIe7uUc8BTetD1+P7kbfIGDRLho=`,
    "base64"
);

async function makeDump(): Promise<string> {
    const tmpDir = os.tmpdir();
    const filename = path.join(tmpDir, "tmp1.xml");
    if (filename) {
        //   return filename;
    }
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard]);
    const ns = addressSpace.registerNamespace("urn:MyPrivateNamespace");

    const node = ns.addObject({
        browseName: "MyCertificate"
    });

    const alarm1 = instantiateCertificateExpirationAlarm(ns, "CertificateExpirationAlarmType", {
        browseName: "MyAlarm",
        nodeId: "s=CertificateExpiredAlarm",

        organizedBy: addressSpace.rootFolder.objects,
        inputNode: NodeId.nullNodeId,
        normalState: NodeId.nullNodeId,
        conditionSource: null,
        optionals: ["ExpirationLimit"],
        conditionName: "CertificateExpired",
        conditionClass: resolveNodeId("CertificateExpirationAlarmType")
    });
    alarm1.certificate.setValueFromSource({
        dataType: DataType.ByteString,
        value: fakeCertificate
    });
    alarm1.expirationLimit!.setValueFromSource({
        dataType: DataType.Double,
        value: 31536000000
    });
    const xml = ns.toNodeset2XML();
    await fs.promises.writeFile(filename, xml);

    await addressSpace.shutdown();
    addressSpace.dispose();

    return filename;
}

describe("Reconstructed alarm", function () {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("should be possible to reconstruct an alarm from a persisted state", async () => {
        const other = await makeDump();
        await generateAddressSpace(addressSpace, [nodesets.standard, other]);

        const ns = addressSpace.registerNamespace("urn:OwnNamespace");
    });
});
