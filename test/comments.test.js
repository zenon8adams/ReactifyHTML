import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::comments`, () => {
    it('should use replace Js comments with JSX style comments', () => {
        const expr = `<script>\n
              const collection = [1, 2, 3];\n
            /*\n
             * let sum = 0;\n
             * for(let i = 0; i < collection.length; ++i) {\n
             *      sum += collection[i];\n
             * }\n
             */\n
                const sum = collection.reduce((sum, val) => sum + val, 0);\n
               </script>`;

        const replMock = cv.strJoin(
            '{ ', expr.slice(expr.indexOf('/*'), expr.indexOf('*/') + 2), ' }',
            '');
        const repl = cv.useJSXStyleComments(expr);
        const actual =
            repl.slice(repl.indexOf('{ /*'), repl.indexOf('*/ }') + 4);

        expect(actual).to.equal(replMock);
    });

    it('should use replace html comments with JSX style comments', () => {
        const expr = `<form action="/action_page.php">
            <!-- <label for="fname">First name:</label><br>
              <input type="text" id="fname" name="fname" value="John"><br>
              <label for="lname">Last name:</label><br> -->
              <input type="text" id="lname" name="lname" value="Doe"><br><br>
              <input type="submit" value="Submit">
               </form>`;

        const replMock = cv.strJoin(
            '{/* ', expr.slice(expr.indexOf('<!--') + 4, expr.indexOf('-->')),
            ' */}', '');
        const repl   = cv.useJSXStyleComments(expr);
        const actual = repl.slice(repl.indexOf('{/*'), repl.indexOf('*/}') + 3);

        expect(actual).to.equal(replMock);
    });
});
