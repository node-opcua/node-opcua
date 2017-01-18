import fs from "fs";

class LineFile {
  constructor() {
    this.__line = [];

    this.write(`// --------- This code has been automatically generated !!! ${(new Date()).toISOString()}`);
  }

  write(...args) {
    let str = "";
    for (let i = 0; i < args.length; i++) {
      str += args[i];
    }
    this.__line.push(str);
  }

  save(filename) {
    fs.writeFileSync(filename, this.__line.join("\n"), "ascii");
  }
}


export { LineFile };
