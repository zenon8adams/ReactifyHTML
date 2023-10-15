import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::selfClosingTags`, () => {
    it('should close self unterminated html tags', () => {
        const expr     = '<input type="text" name="dob">';
        const expected = expr.slice(0, -1) + '/>';

        expect(cv.closeSelfClosingTags(expr)).to.equal(expected);
    });

    it('should find the farthest closing tag', () => {
        const expr = `<input text="text" ` +
            `value="<<I'am Alice>>" name="<Alice>">`;
        const expected = expr.lastIndexOf('>');
        expect(cv.shiftByAttrs(expr, 6)).to.equal(expected);
    });
});
