import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::humanReadable`, () => {
    it('should give a human readable format for raw bytes', () => {
        expect(cv.humanReadableFormOf(1000)).to.equal('1000B');
        expect(cv.humanReadableFormOf(1024 ** 4)).to.equal('1TB');
        try {
            cv.humanReadableFormOf(1024 * 5);
        } catch (err) {
            expect(err.code).to.equal('ERR_ASSERTION');
        }
    });
});
