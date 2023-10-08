import {cv, expect, path} from './test_setup.js';


describe('ReactifyHTML::Element', () => {
    it('should return last entry of container', () => {
        expect(cv.lastEntry([1, 2, 3])).to.equal(3);
        expect(cv.lastEntry([])).to.equal(undefined);
    });
});
