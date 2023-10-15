import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::Existence`, () => {
    it('should check for argument existence', () => {
        expect(cv.isEmpty('.')).to.equal(false);
        expect(cv.isEmpty('')).to.equal(!cv.isNotEmpty(''));

        expect(cv.isNull(null)).to.equal(true);
        expect(cv.isNull(undefined)).to.equal(false);
        expect(cv.isNull(null)).to.equal(!cv.isNotNull(null));
        expect(cv.isNull(0)).to.equal(false);

        expect(cv.isBehaved(null)).to.equal(true);
        expect(cv.isBehaved(undefined)).to.equal(false);
        expect(cv.isBehaved(0)).to.equal(true);
        expect(cv.isBehaved(null)).to.equal(!cv.isNotBehaved(null));

        expect(cv.isDefined(null)).to.equal(false);
        expect(cv.isDefined(undefined)).to.equal(false);
        expect(cv.isDefined(0)).to.equal(true);
        expect(cv.isDefined(0)).to.equal(!cv.isNotDefined(0));
    });
});
