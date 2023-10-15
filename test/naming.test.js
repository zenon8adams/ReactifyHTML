import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::naming`, () => {
    it('should generate name from path', () => {
        expect(cv.deriveNameFrom('pages/my-home-page.js', {
            suffix: 'Page'
        })).to.equal('PagesMyHomePage');

        expect(cv.deriveNameFrom('pages/002 my home page'))
            .to.equal('Pages002MyHomePage');

        expect(cv.deriveNameFrom('002 my home page'))
            .to.equal('P_002MyHomePage');

        expect(cv.deriveNameFrom(
                   'pages/002 my home page', {strip: true, suffix: 'Page'}))
            .to.equal('P_002MyHomePage');

        expect(cv.deriveNameFrom('my_homE page')).to.equal('MyHomePage');
    });
});
