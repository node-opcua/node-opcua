import { createPrivateKey, KeyObject, subtle } from "node:crypto";
import { type PrivateKey, privateKeyToPEM } from "node-opcua-crypto/web";
import { make_warningLog } from "node-opcua-debug";
import { RSAPKCS1V15_Decrypt, RSAPKCS1V15_Encrypt } from "./security_policy";

const warningLog = make_warningLog("NODE-OPCUA-W27");

function myCreatePrivateKey(rawKey: string | Buffer): PrivateKey {
    // // see https://askubuntu.com/questions/1409458/openssl-config-cuases-error-in-node-js-crypto-how-should-the-config-be-updated
    // const backup = process.env.OPENSSL_CONF;
    // process.env.OPENSSL_CONF = "/dev/null";
    const retValue = createPrivateKey(rawKey);
    // process.env.OPENSSL_CONF = backup;
    return { hidden: retValue };
}

export async function testRSAPKCS1V15_EncryptDecrypt() {
    // Skip on non-Node runtimes (browser / Deno / etc.). This diagnostic
    // only makes sense for Node versions in the narrow range affected by
    // CVE-2023-46809; in the browser `process.version` is an empty string
    // under the standard `process` polyfill and the regex below would
    // throw, breaking module load for every downstream consumer.
    if (typeof process === "undefined" || !process.version) {
        return;
    }
    const version = process.version.match(/v([0-9]+)\.([0-9]+)\.([0-9]+)/);
    if (!version) {
        throw new Error("Invalid version");
    }
    const major = parseInt(version[1], 10);
    const _minor = parseInt(version[2], 10);
    _minor;
    const _patch = parseInt(version[3], 10);
    _patch;
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
    const _publicKey = Buffer.from(exportedPublicKey).toString("base64");
    _publicKey;

    // node:crypto's webcrypto.CryptoKey and the DOM lib's CryptoKey type are structurally
    // incompatible only in their `usages` string-literal unions; the runtime value is the same object.
    const privateKeyPem = await privateKeyToPEM(keyPair.privateKey as unknown as CryptoKey);
    // const privateKeyFilename = ""; // fs.mkdtemp((), ".t.pem");
    // await fs.promises.writeFile(privateKeyFilename, privateKeyPem.privPem, "utf-8");
    const privateKey = myCreatePrivateKey(privateKeyPem.privPem);

    const buffer = Buffer.from("buffer");
    let decrypted: Buffer | undefined;
    try {
        const encrypted = RSAPKCS1V15_Encrypt(buffer, KeyObject.from(keyPair.publicKey));

        decrypted = RSAPKCS1V15_Decrypt(encrypted, privateKey);
    } catch (_err) {
        /**  */
    }
    if (decrypted?.toString("ascii") !== "buffer") {
        warningLog("[NODE-OPCUA-W27]", "node version", process.version);
        warningLog("  you need to use node flag --security-revert=CVE-2023-46809 if you have issue with RSA PKCS#1 v1.5");
    }
}
