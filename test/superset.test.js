import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::superset`, () => {
    it('should check if first argument contains all of second argument', () => {
        const base = [
            'The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy',
            'dog'
        ].sort();
        const other = ['The', 'fox', 'jumps', 'over', 'the', 'dog'].sort();
        const third = ['The', 'dog', 'jumps', 'over', 'a', 'fox'].sort();

        expect(cv.isSuperSetOf(base, other)).to.be.equal(true);
        expect(cv.isSuperSetOf(base, third)).to.be.equal(false);
    });
});
