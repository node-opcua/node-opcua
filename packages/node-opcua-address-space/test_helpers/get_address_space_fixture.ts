/**
 * @module node-opcua-address-space
 */
import * as fs from "fs";
import * as path from "path";

export function getAddressSpaceFixture(pathname: string): string {
  
    // find in nodesets folder in the first place
    const folder1 = path.join(__dirname, "../nodesets");   
    if (fs.existsSync(folder1)) {
        const filename = path.join(folder1, pathname);
        if (fs.existsSync(filename)) {
            return filename;      
        }
    }
    
    // find in  test_fixtures seconds
    let folder = path.join(__dirname, "./test_fixtures");
    if (!fs.existsSync(folder)) {
        folder = path.join(__dirname, "../test_helpers/test_fixtures");
        if (!fs.existsSync(folder)) {
            folder = path.join(__dirname, "../../test_helpers/test_fixtures");

            // istanbul ignore next
            if (!fs.existsSync(folder)) {
                // tslint:disable:no-console
                console.log(" cannot find test_fixtures folder ");
            }
        }
    }
    const filename = path.join(folder, pathname);

    // istanbul ignore next
    if (!fs.existsSync(filename)) {
        throw new Error(" cannot find fixture with name " + pathname);
    }
    return filename;
}
