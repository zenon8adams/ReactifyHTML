import {cv, expect, path, PROJECT_NAME} from './test_setup.js';
describe(`${PROJECT_NAME}::Url`, () => {
    it('should check if path is a url', () => {
        expect(cv.isAbsoluteURI(null)).to.equal(false);
        expect(cv.isAbsoluteURI('/usr/bin')).to.equal(false);
        expect(cv.isAbsoluteURI('http://')).to.equal(true);
        expect(cv.isAbsoluteURI('google.com')).to.equal(false);
    });
});
