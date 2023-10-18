import os from 'node:os';

import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::Namespacing`, () => {
    it('should return empty for an empty path', () => {
        const file = '';
        expect(cv.numberOfComponents(file)).to.equal(0);
    });

    it('should return number of actual directories', () => {
        const file = path.join('usr', 'bin');
        expect(cv.numberOfComponents(file)).to.equal(2);
        const tmpdir = os.tmpdir();
        expect(cv.numberOfComponents(file)).to.equal(2);
        const otherFile = path.join(tmpdir, file);
        expect(cv.numberOfComponents(otherFile)).to.be.at.least(3);
    });
});
