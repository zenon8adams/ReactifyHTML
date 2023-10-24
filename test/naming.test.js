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

describe(`${PROJECT_NAME}::project_naming`, () => {
    const sessionID = cv.randomCounter(8);
    it('should generate name based on sessionID', () => {
        const sourceDir = path.join('home', 'project-files', sessionID);
        expect(cv.deriveProjectNameFrom(sourceDir, sessionID))
            .to.match(new RegExp(`.+${sessionID}.+`));
    });

    it('should generate name based on project root', () => {
        const sourceDir = path.join('home', 'project-files');
        expect(cv.deriveProjectNameFrom(sourceDir, sessionID))
            .to.be.equal(path.basename(sourceDir));
    });
});
