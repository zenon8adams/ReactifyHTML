import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::FindEntryPoint`, () => {
    const file = path.join('examples', 'index');
    it('should give path to the landing page', async () => {
        expect(path.parse(await cv.resolveLandingPage(cv.strJoin(file, '.zip')))
                   .ext)
            .to.equal('.html');
        expect(
            path.parse(await cv.resolveLandingPage(cv.strJoin(file, '.html')))
                .ext)
            .to.equal('.html');
    });

    it('should check given path to landing page by file magic', async () => {
        expect(path.parse(await cv.resolveLandingPage(file)).ext)
            .to.equal('.html');
    });
});
