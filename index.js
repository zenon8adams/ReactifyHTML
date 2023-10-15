/*\
 * MIT License
 *
 *
 *   Copyright (c) 2023 Meekness Adesina
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *   and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
\*/
'use strict';
import {Command} from 'commander';
import {generateAllPages, strJoin} from './interface.js';
import {
    PROJECT_NAME,
    PROJECT_DESCRIPTION,
    PROJECT_VERSION
} from './project-info.js';
// --- Command Line --- //

const converterConfig = {};

const program = new Command();
program.name(PROJECT_NAME)
    .description(PROJECT_DESCRIPTION)
    .version(PROJECT_VERSION);
program
    .option(
        '-s, --search-depth <number>',
        strJoin('set search depth when indexing assets', '\n'), -1)
    .option(
        '-d, --deduce-assets-from-base-path',
        strJoin(
            'the entry point should be deduced',
            'from the base directory given', '\n'),
        true)
    .option(
        '-u, --use-path-relative-index',
        strJoin(
            'assets should retain their structure', 'during asset resolution',
            '\n'),
        true)
    .option('-a, --archive', 'compress output project', true)
    .option(
        '-e, --entry-point <string>', 'set entry point to start processing',
        'index.html')
    .option(
        '-w, --weak-replacement',
        strJoin(
            'determines if the href attribute of anchor',
            ' tags can be safely replaced with ', '`javascript:void(0);', '\n'),
        false)
    .arguments('<path|archive|url>')
    .action(
        initial => Object.assign(
            converterConfig, {...converterConfig, initialPath: initial}))
    .parse(process.argv);

const options = program.opts();
if (options.help) {
    program.outputHelp();
    process.exit(0);
} else {
    Object.assign(converterConfig, {...options});
}

// --- Command Line --- //
await generateAllPages(converterConfig);
