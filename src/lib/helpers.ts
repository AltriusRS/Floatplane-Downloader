import { downloadBinaries, detectPlatform, getBinaryFilename } from 'ffbinaries';
import { getEnv, rebuildTypes, recursiveUpdate } from '@inrixia/helpers/object.js';
import { defaultArgs, defaultSettings } from './defaults.js';
import db from '@inrixia/db';
import fs from 'fs';

import { defaultImport } from 'default-import';

import _ARGV from 'process.argv';
const ARGV = defaultImport(_ARGV);

import 'dotenv/config';

import json5 from 'json5';
const { parse } = json5;

import type { PartialArgs, Settings } from './types.js';

import { FileCookieStore } from 'tough-cookie-file-store';
import { CookieJar } from 'tough-cookie';
export const cookieJar = new CookieJar(new FileCookieStore('./db/cookies.json'));

import { Floatplane } from 'floatplane';
export const fApi = new Floatplane(cookieJar);

export const settings = db<Settings>('./db/settings.json', { template: defaultSettings, pretty: true, forceCreate: true, updateOnExternalChanges: true });
recursiveUpdate(settings, defaultSettings);

const argv = ARGV(process.argv.slice(2))<PartialArgs>({});
rebuildTypes(argv, { ...defaultSettings, ...defaultArgs });
recursiveUpdate(settings, argv, { setUndefined: false, setDefined: true });

const env = getEnv();
rebuildTypes(env, { ...defaultSettings, ...defaultArgs });

if (env.__FPDSettings !== undefined) {
	if (typeof env.__FPDSettings !== 'string') throw new Error('The __FPDSettings environment variable cannot be parsed!');
	recursiveUpdate(settings, parse(env.__FPDSettings.replaceAll('\\"', '"')), { setUndefined: false, setDefined: true });
}

recursiveUpdate(settings, env, { setUndefined: false, setDefined: true });

export const args = { ...argv, ...env };

// Override stdout if headless to not include formatting tags
if (args.headless === true) {
	const originalStdoutWrite = process.stdout.write.bind(process.stdout);
	type StdoutArgs = Parameters<typeof process.stdout.write>;

	process.stdout.write = ((...params: StdoutArgs) => {
		// eslint-disable-next-line no-control-regex
		if (typeof params[0] === 'string') params[0] = params[0].replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
		return originalStdoutWrite(...params);
	}) as typeof process.stdout.write;
}

export const fetchFFMPEG = (): Promise<void> =>
	new Promise((resolve, reject) => {
		const platform = detectPlatform();
		const path = args.headless === true ? './' : './db/';
		if (fs.existsSync(`${path}${getBinaryFilename('ffmpeg', platform)}`) === false) {
			process.stdout.write('> Ffmpeg binary missing! Downloading... ');
			downloadBinaries(
				'ffmpeg',
				{
					destination: path,
					platform,
				},
				(err) => {
					if (err !== null) reject(err);
					else {
						process.stdout.write('\u001b[36mDone!\u001b[0m\n\n');
						resolve();
					}
				}
			);
		} else resolve();
	});
