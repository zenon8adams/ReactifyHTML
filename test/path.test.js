import fs from 'node:fs/promises';
import os from 'node:os';
import {rimraf} from 'rimraf';

import {cv, expect, path} from './test_setup.js';

const sessionID    = '0x01729012';
const temporaryDir = path.join(os.tmpdir(), 'ReactifyHTML', sessionID);
before(async () => {
    await fs.mkdir(temporaryDir, {recursive: true});
});

describe('ReactifyHTML::path', () => {
    it('should return reference to previous directory', () => {
        expect(cv.bt(path.join('usr', 'local', 'bin')))
            .to.equal(path.join('usr', 'local'));
    });

    it('should return absolute path of argument', () => {
        expect(cv.fullPathOf('.')).to.equal(process.cwd());
        expect(cv.fullPathOf('..')).to.equal(cv.bt(process.cwd()));
    });

    it('should check if basename of provided path refers to same file', () => {
        expect(cv.isSelfReference('/usr/local/my-file.txt', 'my-file.txt'))
            .to.equal(true);
        expect(cv.isSelfReference('/usr/local/my-file.txt', 'other-file.txt'))
            .to.equal(false);
    });

    it('should remove every back reference in path (..)', () => {
        expect(cv.removeBackLinks('/usr/../bin')).to.equal('/usr/bin');
        expect(cv.removeBackLinks('/usr/../')).to.equal('/usr/');
        expect(cv.removeBackLinks('../..')).to.equal('');
    });

    it('should return parent path', async () => {
        const testDir = path.join(temporaryDir, '/home/user/files/');
        const refFile =
            path.join(temporaryDir, '/home/user/files/html/index.html');
        await fs.mkdir(testDir, {recursive: true});
        await fs.mkdir(path.dirname(refFile), {recursive: true});

        expect(cv.getRootDirectory(refFile, testDir)).to.equal(testDir);
        expect(cv.getRootDirectory(refFile, 'https://example.com/archive.zip'))
            .to.equal(path.dirname(refFile));
    });

    it('should break down path details', () => {
        const os_re = p => cv.useOSIndependentPath(p);
        const file      = '/home/user/files/img-driver.jpg?v1.23.22';
        const fileInfo  = cv.parseFile(file);

        expect(os_re(fileInfo.original)).to.equal(os_re(file));
        expect(os_re(fileInfo.realpath))
            .to.equal(os_re(file.slice(0, file.indexOf('?'))));
        expect(fileInfo.extv2)
            .to.equal(file.slice(file.indexOf('.') + 1, file.indexOf('?')));
        expect(fileInfo.version).to.equal(file.slice(file.indexOf('?') + 1));
    });
});

after(async () => {
    await rimraf(temporaryDir);
});
