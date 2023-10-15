import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::extract`, () => {
    it('should extract description from meta tags', () => {
        const metasMock = [
            {name: 'description', content: 'This is the required text'},
            {name: 'viewport', content: 'width=device-width, initial-scale='}
        ];

        expect(cv.extractDescription(metasMock)).to.equal(metasMock[0].content);

        metasMock.splice(0, 1);
        expect(cv.extractDescription(metasMock)).to.contain('ReactifyHTML');
    });

    it('should cut the input string to at most max length', () => {
        const test = 'The quick brown fox jumps over the lazy dog.';

        expect(cv.clip(test)).to.equal(test);
        expect(cv.clip(test, 10)).to.equal(test.slice(0, 10) + '...');
    });
});
