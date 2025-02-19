// @flow
import type {FileSystem} from '@parcel/fs';
import SourceMap from '@parcel/source-map';
import path from 'path';
import {normalizeSeparators} from './path';

export const SOURCEMAP_RE: RegExp = /(?:\/\*|\/\/)\s*[@#]\s*sourceMappingURL\s*=\s*([^\s*]+)(?:\s*\*\/)?\s*$/;
const DATA_URL_RE = /^data:[^;]+(?:;charset=[^;]+)?;base64,(.*)/;
export const SOURCEMAP_EXTENSIONS: Set<string> = new Set<string>([
  'js',
  'jsx',
  'mjs',
  'es',
  'es6',
  'css',
]);

export function matchSourceMappingURL(
  contents: string,
): null | RegExp$matchResult {
  return contents.match(SOURCEMAP_RE);
}

export async function loadSourceMapUrl(
  fs: FileSystem,
  filename: string,
  contents: string,
): Promise<?{|filename: string, map: any, url: string|}> {
  let match = matchSourceMappingURL(contents);
  if (match) {
    let url = match[1].trim();
    let dataURLMatch = url.match(DATA_URL_RE);
    filename = dataURLMatch ? filename : path.join(path.dirname(filename), url);

    return {
      url,
      filename,
      map: JSON.parse(
        dataURLMatch
          ? Buffer.from(dataURLMatch[1], 'base64').toString()
          : await fs.readFile(filename, 'utf8'),
      ),
    };
  }
}

export async function loadSourceMap(
  filename: string,
  contents: string,
  options: {fs: FileSystem, projectRoot: string, ...},
): Promise<?SourceMap> {
  let foundMap = await loadSourceMapUrl(options.fs, filename, contents);
  if (foundMap) {
    let mapSourceRoot = path.dirname(filename);
    if (
      foundMap.map.sourceRoot &&
      !normalizeSeparators(foundMap.map.sourceRoot).startsWith('/')
    ) {
      mapSourceRoot = path.join(mapSourceRoot, foundMap.map.sourceRoot);
    }

    let sourcemapInstance = new SourceMap(options.projectRoot);
    sourcemapInstance.addRawMappings({
      ...foundMap.map,
      sources: foundMap.map.sources.map(s => {
        return path.join(mapSourceRoot, s);
      }),
    });
    return sourcemapInstance;
  }
}
