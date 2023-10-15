import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::Types`, () => {
    it('should check the type of argument', () => {
        expect(cv.isArray([])).to.equal(true);
        expect(cv.isArray(0)).to.equal(false);

        expect(cv.isObject(0)).to.equal(false);
        expect(cv.isObject({})).to.equal(true);

        expect(cv.isBoolean(0)).to.equal(false);
        expect(cv.isBoolean(false)).to.equal(true);

        expect(cv.isString(0)).to.equal(false);
        expect(cv.isString('')).to.equal(true);

        expect(cv.isNumber(0)).to.equal(true);
        expect(cv.isNumber('')).to.equal(false);

        expect(cv.isRegExp(/^$/)).to.equal(true);
        expect(cv.isRegExp(new RegExp('^$'))).to.equal(true);
        expect(cv.isRegExp('')).to.equal(false);
    });
});
