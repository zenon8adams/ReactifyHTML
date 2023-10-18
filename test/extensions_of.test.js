import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::extensionsOf`, () => {
    it('should return the empty extension', () => {
        const file = 'basic';
        expect(cv.extensionsOf(file, 1)).to.equal('');
        try {
            cv.extensionsOf(file, -1);
        } catch (err) {
            expect(err.code).to.equal('ERR_ASSERTION');
        }
        expect(cv.extensionsOf(file, 2)).to.have.lengthOf(0);
    });

    it('should return extension of file', () => {
        const file = 'basic.zip.gz';
        expect(cv.extensionsOf(file, 1)).to.equal('.gz');
        expect(cv.extensionsOf(file, 2)).to.equal('.zip.gz');
        expect(cv.extensionsOf(file, 3)).to.equal('.zip.gz');
    });
});
