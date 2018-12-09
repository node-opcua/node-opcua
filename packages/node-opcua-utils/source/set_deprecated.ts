const assert = require("node-opcua-assert").assert;
const chalk = require("chalk");
export function setDeprecated(Constructor: Function,methodName: string ,helpString: string):void
{
    const old_method= Constructor.prototype[methodName];
    assert(old_method instanceof Function,"expecting a valid " + methodName + "method on class ", Constructor.constructor.name);


    let counter = 0;
    Constructor.prototype[methodName] = function() {
        if (counter % 1000 === 0 ) {
            console.log(chalk.green("Warning !"),"", chalk.green(chalk.bold(Constructor.name+"#"+methodName)," is now deprecated"));
            console.log("         ", helpString);
        }
        counter ++;
        return old_method.apply(this,arguments);
    }

}
