"use strcit";
import "should";
import fs from "node:fs";

import { getTempFilename, redirectToFile } from "../nodeJS.js";

describe("testing redirectToFile", () => {
    it("should redirectToFile with a sync function", () => {
        redirectToFile("redirectToFile_without_callback.log", () => {
            console.log("Hello World");
        });
    });

    it("should redirectToFile with a  callback", (done) => {
        redirectToFile(
            "redirectToFile_with_a_callback.log",
            () => {
                console.log("Hello World");
            },
            done
        );
    });

    it("should redirectToFile with a sync function", () => {
        redirectToFile(
            "redirectToFile_sync.log",
            () => {
                console.log("Hello World");
            },
            () => {
                const filename = getTempFilename("redirectToFile_sync.log");
                const txt = fs.readFileSync(filename, "utf-8");
                txt.should.eql("Hello World\n");
            }
        );
    });

    function async_function(callback: () => void) {
        setImmediate(() => {
            console.log("Hello World !!!");
            callback();
        });
    }

    it("should redirectToFile with a asynchronous function", (done) => {
        redirectToFile(
            "redirectToFile_async.log",
            (inner_done) => {
                async_function(inner_done);
            },
            () => {
                const filename = getTempFilename("redirectToFile_async.log");
                const txt = fs.readFileSync(filename, "utf-8");
                txt.should.eql("Hello World !!!\n");
                done();
            }
        );
    });
});
