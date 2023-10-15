import chai from 'chai';
import path from 'node:path';

import {exports} from '../interface.js';
import {PROJECT_NAME} from '../project-info.js';

const expect = chai.expect;
const cv     = exports();

export {expect, cv, path, PROJECT_NAME};
