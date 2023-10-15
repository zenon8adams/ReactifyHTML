import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const packageFile = path.join(__dirname, 'package.json');
const info        = JSON.parse(await fsp.readFile(packageFile));


export const PROJECT_NAME        = info.name;
export const PROJECT_VERSION     = info.version;
export const PROJECT_DESCRIPTION = info.description;
