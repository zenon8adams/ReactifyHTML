import {cv, expect, path} from './test_setup.js';

describe('ReactifyHTML::RegularExpressionSort', () => {
    it('should sort `re` matches by `index` in descending order', () => {
        const re      = /([a-z]+)/gm;
        const expr    = 'split this string into substrings';
        const indexes = [23, 18, 11, 6, 0];
        const matches = Array.from(expr.matchAll(re))
                            .sort(cv.sortIndexDesc)
                            .map(m => m.index);
        expect(indexes).deep.to.equal(matches);
    });
});
