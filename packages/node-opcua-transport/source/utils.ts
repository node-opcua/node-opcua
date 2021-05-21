// 
const transportFlag = (process.env?.NODEOPCUADEBUG?.match(/TRANSPORT{([^}]*)}/) || [])[1] || "";
export const doTraceHelloAck = transportFlag.match(/HELACK/);
export const doTraceChunk = transportFlag.match(/CHUNK/);
