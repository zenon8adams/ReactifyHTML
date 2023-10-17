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
import {Command, Option} from 'commander';
import {generateAllPages, strJoin} from './interface.js';
import {
    PROJECT_NAME,
    PROJECT_DESCRIPTION,
    PROJECT_VERSION
} from './project-info.js';
// --- Command Line --- //

const converterConfig = {
    searchDepth: -1,
    deduceAssetsFromBasePath: true,
    usePathRelativeIndex: true,
    archive: true,
    entryPoint: 'index.html',
    weakReplacement: false,
    useAsciiDisplay: false
};

function parseBoolean(str) {
    return str === 'true' || +str > 0;
}

const program = new Command();
program.name(PROJECT_NAME)
    .description(PROJECT_DESCRIPTION)
    .version(PROJECT_VERSION);
program
    .addOption(new Option(
                   '-s, --search-depth <number>',
                   strJoin('set search depth when indexing assets', '\n'))
                   .default(converterConfig.searchDepth, 'infinite(-1)')
                   .argParser(parseInt))
    .addOption(new Option(
                   '-d, --deduce-assets-from-base-path <boolean>',
                   strJoin(
                       'the entry point should be deduced',
                       'from the base directory given', '\n'))
                   .default(converterConfig.deduceAssetsFromBasePath)
                   .argParser(parseBoolean))
    .addOption(new Option(
                   '-u, --use-path-relative-index <boolean>',
                   strJoin(
                       'assets should retain their structure',
                       'during asset resolution', '\n'))
                   .default(converterConfig.usePathRelativeIndex)
                   .argParser(parseBoolean))
    .addOption(
        new Option(
            '-i, --use-ascii-display <boolean>', 'Display only ascii loaders')
            .default(converterConfig.useAsciiDisplay)
            .argParser(parseBoolean))
    .addOption(new Option('-a, --archive <boolean>', 'compress output project')
                   .default(converterConfig.archive)
                   .argParser(parseBoolean))
    .option(
        '-e, --entry-point <string>', 'set entry point to start processing',
        'index.html')
    .addOption(new Option(
                   '-w, --weak-replacement <boolean>',
                   strJoin(
                       'determines if the href attribute of anchor',
                       'tags can be safely replaced with',
                       '`javascript:void(0);', '\n'))
                   .default(converterConfig.weakReplacement)
                   .argParser(parseBoolean))
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
