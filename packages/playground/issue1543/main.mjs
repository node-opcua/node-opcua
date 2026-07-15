import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPCUAServer, nodesets } from 'node-opcua';

// the official TMC nodeset. note: this is the raw form of
// https://github.com/OPCFoundation/UA-Nodeset/blob/latest/TMC/Opc.Ua.TMC.NodeSet2.xml
// ( the /blob/ url serves a HTML page, not the xml )
const nodesetUrl =
  'https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/latest/TMC/Opc.Ua.TMC.NodeSet2.xml';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodesetFilename = path.join(here, 'Opc.Ua.TMC.NodeSet2.xml');

// the server loads nodesets from disk, so download the file once and keep it next to this script
async function downloadNodesetIfNeeded() {
  try {
    await access(nodesetFilename);
    console.log(`using already downloaded ${nodesetFilename}`);
    return;
  } catch {
    // not downloaded yet
  }

  console.log(`downloading ${nodesetUrl} ...`);
  const response = await fetch(nodesetUrl);
  if (!response.ok) {
    throw new Error(`cannot download ${nodesetUrl} : ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  await writeFile(nodesetFilename, xml, 'utf-8');
  console.log(`downloaded ${xml.length} bytes to ${nodesetFilename}`);
}

(async () => {
  try {
    await downloadNodesetIfNeeded();

    // Let create an instance of OPCUAServer
    const server = new OPCUAServer({
      port: 26543, // the port of the listening socket of the server

      nodeset_filename: [
        nodesets.standard,
        nodesets.di,
        nodesets.packML,
        nodesetFilename
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
