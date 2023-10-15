import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::StringEdit`, () => {
    it('should remove quote from maybe quoted string', () => {
        expect(cv.unQuote('"This"')).to.equal('This');
        expect(cv.unQuote('This')).to.equal('This');
        expect(cv.unQuote('&quot;This')).to.equal('&quot;This');
        expect(cv.unQuote('This&quot;')).to.equal('This&quot;');
        expect(cv.unQuote('\\"This\\"')).to.equal('This');
    });

    it('should convert first character only to upper case', () => {
        expect(cv.capitalize('Hello')).to.equal('Hello');
        expect(cv.capitalize('hEllO')).to.equal('Hello');
        expect(cv.capitalize('h')).to.equal('H');
        expect(cv.capitalize('')).to.equal('');
    });
});
