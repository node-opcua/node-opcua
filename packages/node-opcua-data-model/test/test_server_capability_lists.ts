import should from "should";
import {
    addCapabilityIdentifier,
    addProfileUri,
    isValidCapabilityIdentifier,
    isValidProfileUri,
    NO_CAPABILITY_IDENTIFIER,
    removeCapabilityIdentifier,
    removeProfileUri
} from "../dist/index.js";

const standard = "http://opcfoundation.org/UA-Profile/Server/Standard";
const globalCertificateManagement = "http://opcfoundation.org/UA-Profile/Server/GlobalCertificateManagement";
const dataAccess = "http://opcfoundation.org/UA-Profile/Server/DataAccess";

describe("ServerCapabilityIdentifier list (OPC 10000-12 Annex D)", () => {
    describe("addCapabilityIdentifier", () => {
        it("should add to an empty list", () => {
            const capabilities: string[] = [];
            should(addCapabilityIdentifier(capabilities, "DA")).eql(true);
            should(capabilities).eql(["DA"]);
        });

        it("should replace the NA placeholder rather than sitting beside it", () => {
            const capabilities = [NO_CAPABILITY_IDENTIFIER];
            should(addCapabilityIdentifier(capabilities, "GDS")).eql(true);
            should(capabilities).eql(["GDS"]);
        });

        it("should recognise the NA placeholder in any case", () => {
            const capabilities = ["na"];
            should(addCapabilityIdentifier(capabilities, "DA")).eql(true);
            should(capabilities).eql(["DA"]);
        });

        it("should keep the list sorted", () => {
            const capabilities = ["HD", "DA"];
            should(addCapabilityIdentifier(capabilities, "AC")).eql(true);
            should(capabilities).eql(["AC", "DA", "HD"]);
        });

        it("should be idempotent", () => {
            const capabilities = ["DA"];
            should(addCapabilityIdentifier(capabilities, "HD")).eql(true);
            should(addCapabilityIdentifier(capabilities, "HD")).eql(false);
            should(capabilities).eql(["DA", "HD"]);
        });

        it("should compare case-insensitively and keep the case already declared", () => {
            const capabilities = ["Alias"];
            should(addCapabilityIdentifier(capabilities, "ALIAS")).eql(false);
            should(capabilities).eql(["Alias"]);
        });

        it("should remove duplicates already in the list", () => {
            const capabilities = ["DA", "da", "HD", "DA"];
            should(addCapabilityIdentifier(capabilities, "AC")).eql(true);
            should(capabilities).eql(["AC", "DA", "HD"]);
        });

        it("should not add NA beside a real identifier", () => {
            const capabilities = ["DA"];
            should(addCapabilityIdentifier(capabilities, NO_CAPABILITY_IDENTIFIER)).eql(false);
            should(capabilities).eql(["DA"]);
        });

        it("should add NA to an empty list", () => {
            const capabilities: string[] = [];
            should(addCapabilityIdentifier(capabilities, NO_CAPABILITY_IDENTIFIER)).eql(true);
            should(capabilities).eql([NO_CAPABILITY_IDENTIFIER]);
        });

        it("should edit the list in place", () => {
            const capabilities = ["NA"];
            const sameReference = capabilities;
            addCapabilityIdentifier(capabilities, "DA");
            should(sameReference).equal(capabilities);
            should(sameReference).eql(["DA"]);
        });
    });

    describe("removeCapabilityIdentifier", () => {
        it("should remove an identifier, case-insensitively", () => {
            const capabilities = ["DA", "HD"];
            should(removeCapabilityIdentifier(capabilities, "hd")).eql(true);
            should(capabilities).eql(["DA"]);
        });

        it("should restore NA when the last real identifier goes", () => {
            const capabilities = ["DA"];
            should(removeCapabilityIdentifier(capabilities, "DA")).eql(true);
            should(capabilities).eql([NO_CAPABILITY_IDENTIFIER]);
        });

        it("should be idempotent", () => {
            const capabilities = ["DA", "HD"];
            should(removeCapabilityIdentifier(capabilities, "HD")).eql(true);
            should(removeCapabilityIdentifier(capabilities, "HD")).eql(false);
            should(capabilities).eql(["DA"]);
        });

        it("should leave an empty list empty when there was nothing to remove", () => {
            const capabilities: string[] = [];
            should(removeCapabilityIdentifier(capabilities, "DA")).eql(false);
            should(capabilities).eql([]);
        });

        it("should not change a list holding only NA", () => {
            const capabilities = [NO_CAPABILITY_IDENTIFIER];
            should(removeCapabilityIdentifier(capabilities, "DA")).eql(false);
            should(removeCapabilityIdentifier(capabilities, NO_CAPABILITY_IDENTIFIER)).eql(false);
            should(capabilities).eql([NO_CAPABILITY_IDENTIFIER]);
        });
    });

    describe("validation", () => {
        it("should accept the identifiers of Annex D Table D.1", () => {
            for (const identifier of [
                "NA",
                "DA",
                "HD",
                "AC",
                "HE",
                "GDS",
                "LDS",
                "DI",
                "ADI",
                "FDI",
                "FDIC",
                "PLC",
                "S95",
                "ALIAS"
            ]) {
                should(isValidCapabilityIdentifier(identifier)).eql(true, identifier);
            }
        });

        it("should reject garbage", () => {
            for (const garbage of ["", " ", "D A", " DA", "DA,HD", "caps=DA", standard, "x".repeat(33), "-DA"]) {
                should(isValidCapabilityIdentifier(garbage)).eql(false, JSON.stringify(garbage));
                should(() => addCapabilityIdentifier([], garbage)).throw(/Invalid ServerCapabilityIdentifier/);
                should(() => removeCapabilityIdentifier([], garbage)).throw(/Invalid ServerCapabilityIdentifier/);
            }
        });

        it("should reject a value that is not a string", () => {
            for (const garbage of [undefined, null, 42, {}]) {
                should(isValidCapabilityIdentifier(garbage)).eql(false);
                should(() => addCapabilityIdentifier([], garbage as unknown as string)).throw(/Invalid ServerCapabilityIdentifier/);
            }
        });

        it("should leave the list untouched when it throws", () => {
            const capabilities = ["NA"];
            should(() => addCapabilityIdentifier(capabilities, "not valid")).throw();
            should(capabilities).eql(["NA"]);
        });
    });
});

describe("ServerProfileArray list", () => {
    describe("addProfileUri", () => {
        it("should add to an empty list", () => {
            const profiles: string[] = [];
            should(addProfileUri(profiles, standard)).eql(true);
            should(profiles).eql([standard]);
        });

        it("should keep the list sorted", () => {
            const profiles = [standard];
            should(addProfileUri(profiles, globalCertificateManagement)).eql(true);
            should(addProfileUri(profiles, dataAccess)).eql(true);
            should(profiles).eql([dataAccess, globalCertificateManagement, standard]);
        });

        it("should be idempotent", () => {
            const profiles = [standard];
            should(addProfileUri(profiles, globalCertificateManagement)).eql(true);
            should(addProfileUri(profiles, globalCertificateManagement)).eql(false);
            should(profiles).eql([globalCertificateManagement, standard]);
        });

        it("should remove duplicates already in the list", () => {
            const profiles = [standard, standard];
            should(addProfileUri(profiles, dataAccess)).eql(true);
            should(profiles).eql([dataAccess, standard]);
        });

        it("should edit the list in place", () => {
            const profiles = [standard];
            const sameReference = profiles;
            addProfileUri(profiles, dataAccess);
            should(sameReference).equal(profiles);
            should(sameReference).eql([dataAccess, standard]);
        });

        it("should never produce an NA placeholder", () => {
            const profiles = [standard];
            should(removeProfileUri(profiles, standard)).eql(true);
            should(profiles).eql([]);
        });
    });

    describe("removeProfileUri", () => {
        it("should remove a URI", () => {
            const profiles = [dataAccess, standard];
            should(removeProfileUri(profiles, dataAccess)).eql(true);
            should(profiles).eql([standard]);
        });

        it("should be idempotent", () => {
            const profiles = [dataAccess, standard];
            should(removeProfileUri(profiles, dataAccess)).eql(true);
            should(removeProfileUri(profiles, dataAccess)).eql(false);
            should(profiles).eql([standard]);
        });
    });

    describe("validation", () => {
        it("should accept absolute URIs", () => {
            for (const uri of [standard, "urn:vendor:profile:x", "https://example.com/UA-Profile/Server/Custom"]) {
                should(isValidProfileUri(uri)).eql(true, uri);
            }
        });

        it("should reject garbage", () => {
            for (const garbage of [
                "",
                "DA",
                "Standard UA Server Profile",
                "/UA-Profile/Server/Standard",
                ` ${standard}`,
                `${standard} `
            ]) {
                should(isValidProfileUri(garbage)).eql(false, JSON.stringify(garbage));
                should(() => addProfileUri([], garbage)).throw(/Invalid profile URI/);
                should(() => removeProfileUri([], garbage)).throw(/Invalid profile URI/);
            }
        });

        it("should reject a value that is not a string", () => {
            for (const garbage of [undefined, null, 42, {}]) {
                should(isValidProfileUri(garbage)).eql(false);
                should(() => addProfileUri([], garbage as unknown as string)).throw(/Invalid profile URI/);
            }
        });
    });
});
