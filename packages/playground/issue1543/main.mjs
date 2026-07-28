import { OPCUAServer, nodesets } from 'node-opcua';
import { downloadTMCNodesetIfNeeded } from './tmc-nodeset.mjs';

(async () => {
  try {
    const tmcNodesetFilename = await downloadTMCNodesetIfNeeded();

    // Let create an instance of OPCUAServer
    const server = new OPCUAServer({
      port: 26543, // the port of the listening socket of the server

      nodeset_filename: [
        nodesets.standard,
        nodesets.di,
        nodesets.packML,
        tmcNodesetFilename
      ],
    });

    await server.initialize();

    // we can now start the server
    await server.start();

    console.log('Server is now listening ... ( press CTRL+C to stop) ');

    await new Promise((resolve) => process.once('SIGINT', resolve));

    await server.shutdown();
    console.log('server shutdown completed !');
  } catch (err) {
    console.log(err.message);
    process.exit(-1);
  }
})();
