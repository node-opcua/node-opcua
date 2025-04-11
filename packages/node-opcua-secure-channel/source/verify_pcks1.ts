import { KeyObject, createPrivateKey, subtle } from "crypto";
import { privateKeyToPEM } from "node-opcua-crypto/web";
import { make_warningLog } from "node-opcua-debug";
import { RSAPKCS1V15_Encrypt, RSAPKCS1V15_Decrypt } from "./security_policy";

const warningLog = make_warningLog("NODE-OPCUA-W27");

function myCreatePrivateKey(rawKey: string | Buffer): any {
    // // see https://askubuntu.com/questions/1409458/openssl-config-cuases-error-in-node-js-crypto-how-should-the-config-be-updated
    // const backup = process.env.OPENSSL_CONF;
    // process.env.OPENSSL_CONF = "/dev/null";
    const retValue = createPrivateKey(rawKey);
    // process.env.OPENSSL_CONF = backup;
    return { hidden: retValue };
}

export async function testRSAPKCS1V15_EncryptDecrypt() {

    const version = process.version.match(/v([0-9]+)\.([0-9]+)\.([0-9]+)/);
    if (!version) {
        throw new Error("Invalid version");
    }   
    const major = parseInt(version[1], 10);
    const minor = parseInt(version[2], 10); minor;
    const patch = parseInt(version[3], 10); patch;
    if (major < 20) {
        return; // skip test
    }
    if (major >= 22) {
        // node 22 and above has a permanent security fix that prevent RSA PKCS#1 v1.5 altogether
        // there is nothing we can do anymore to workaround this.
        return; // skip test
    }
    const keyPair = await subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-512"
        },
        true,
        ["encrypt", "decrypt"]
    );

    // export public key as base64 string and save to file
    const exportedPublicKey = await subtle.exportKey("spki", keyPair.publicKey);
    const publicKey = Buffer.from(exportedPublicKey).toString("base64");
    publicKey;

    const privateKeyPem = await privateKeyToPEM(keyPair.privateKey);
    // const privateKeyFilename = ""; // fs.mkdtemp((), ".t.pem");
    // await fs.promises.writeFile(privateKeyFilename, privateKeyPem.privPem, "utf-8");
    const privateKey = myCreatePrivateKey(privateKeyPem.privPem);

    const buffer = Buffer.from("buffer");
    let decrypted: Buffer | undefined;
    try {
        const encrypted = RSAPKCS1V15_Encrypt(buffer, KeyObject.from(keyPair.publicKey));

        decrypted = RSAPKCS1V15_Decrypt(encrypted, privateKey);
    } catch (err) { /**  */}
    if (!decrypted || decrypted.toString("ascii") !== "buffer") {
        warningLog("[NODE-OPCUA-W27]", "node version", process.version);
        warningLog("  you need to use node flag --security-revert=CVE-2023-46809 if you have issue with RSA PKCS#1 v1.5");
    }
}
