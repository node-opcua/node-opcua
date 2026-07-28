import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// the official TMC nodeset. note: this is the raw form of
// https://github.com/OPCFoundation/UA-Nodeset/blob/latest/TMC/Opc.Ua.TMC.NodeSet2.xml
// ( the /blob/ url serves a HTML page, not the xml )
const nodesetUrl =
  'https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/latest/TMC/Opc.Ua.TMC.NodeSet2.xml';

const here = path.dirname(fileURLToPath(import.meta.url));

// keep the file next to this script, so it is found whatever the current working directory is
export const tmcNodesetFilename = path.join(here, 'Opc.Ua.TMC.NodeSet2.xml');

// the nodeset is loaded from disk, so download the file once and keep it next to this script
export async function downloadTMCNodesetIfNeeded() {
  try {
    await access(tmcNodesetFilename);
    console.log(`using already downloaded ${tmcNodesetFilename}`);
    return tmcNodesetFilename;
  } catch {
    // not downloaded yet
  }

  console.log(`downloading ${nodesetUrl} ...`);
  const response = await fetch(nodesetUrl);
  if (!response.ok) {
    throw new Error(`cannot download ${nodesetUrl} : ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  await writeFile(tmcNodesetFilename, xml, 'utf-8');
  console.log(`downloaded ${xml.length} bytes to ${tmcNodesetFilename}`);
  return tmcNodesetFilename;
}
