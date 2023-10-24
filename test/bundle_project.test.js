import {assert} from 'chai';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import {rimraf} from 'rimraf';

import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

const sessionID    = cv.randomCounter(8);
const temporaryDir = path.join(os.tmpdir(), PROJECT_NAME, sessionID);
const exampleFile  = path.join('examples', 'index.html');
before(async () => {
    await fsp.mkdir(
        path.join(temporaryDir, path.dirname(exampleFile)), {recursive: true});
    await fsp.copyFile(
        path.resolve(exampleFile), path.join(temporaryDir, exampleFile));
});

describe(`${PROJECT_NAME}::bundle`, () => {
    it('should generate a compressed file', async () => {
        const exampleFullPath = path.join(temporaryDir, exampleFile);
        const exampleDir      = path.dirname(exampleFullPath);
        await cv.bundleProject(exampleDir, 'example');
        const outputFile = path.join(exampleDir, 'example.tar.gz');
        assert.isOk(await fs.existsSync(outputFile));
    });
});

after(async () => {
    await rimraf(temporaryDir);
});
