import {cv, expect, path} from './test_setup.js';

describe('ReactifyHTML::Namespacing', () => {
    it('should check if attribute is namespaced', () => {
        expect(!!cv.isNamespaced(':checked')).to.equal(false);
        expect(!!cv.isNamespaced('xmlns:prefix')).to.equal(true);
    });
});
