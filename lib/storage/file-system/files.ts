import fs from 'fs';
import jsstream from 'stream';
import * as RDF from 'rdf-js';
import Node from '../../models/node';
import path from 'path';

const ttl_write = require('@graphy/content.ttl.write');
const ttl_read = require('@graphy/content.ttl.read');

import rdfParser from 'rdf-parse';

import rdfSerializer from 'rdf-serialize';
import { FRAME } from '../../utils/context-jsonld';
import * as jsonld from 'jsonld';
import { BASE_FOLDER, DOMAIN_NAME } from '../../utils/constants';
import {
  convertToNode,
  convertToStream,
} from '../../converters/node-converters';
import { createStore } from '../../utils/utils';

export async function convertToJsonLD(file: string): Promise<any> {
  const quadStream = readTriplesStream(
    file,
    DOMAIN_NAME + path.relative(BASE_FOLDER, file)
  );
  const quads: RDF.Quad[] = [];
  await new Promise<void>((resolve, reject) => {
    quadStream.on('data', (quad) => {
      quads.push(quad);
    });
    quadStream.on('error', reject);
    quadStream.on('end', resolve);
  });
  const jsonDoc = await jsonld.fromRDF(quads);
  return jsonld.frame(jsonDoc, FRAME);
}

/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @return {Stream} Stream containing all triples which were downloaded.
 */

export function convert(
  file: string,
  contentType: string
): NodeJS.ReadableStream {
  const triplesStream = readTriplesStream(
    file,
    path.join(DOMAIN_NAME, path.relative(BASE_FOLDER, file))
  );
  return rdfSerializer.serialize(triplesStream, {
    contentType: contentType,
  });
}

export function readTriplesStream(
  file: string,
  baseIRI?: string
): jsstream.Readable {
  if (!fs.existsSync(file)) {
    throw Error(`File does not exist: ${file}`);
  }
  const fileStream = fs.createReadStream(file);
  if (baseIRI) {
    return rdfParser.parse(fileStream, {
      contentType: 'text/turtle',
      baseIRI,
    });
  } else {
    return fileStream.pipe(ttl_read());
  }
}

async function createParentFolderIfNecessary(file: string) {
  if (!fs.existsSync(path.dirname(file))) {
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(path.dirname(file), { recursive: true }, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

export async function readNode(filePath: string): Promise<Node> {
  const store = await createStore(readTriplesStream(filePath));
  return convertToNode(store);
}

export async function writeNode(node: Node, path: string) {
  const quadStream = convertToStream(node);

  await createParentFolderIfNecessary(path);
  const turtleStream = quadStream.pipe(ttl_write());
  const writeStream = fs.createWriteStream(path);

  turtleStream.on('data', (turtleChunk: any) => {
    writeStream.write(turtleChunk);
  });

  return new Promise<void>((resolve, reject) => {
    turtleStream.on('error', () => {
      reject();
    });
    turtleStream.on('end', () => {
      writeStream.end(() => {
        resolve();
      });
    });
  });
}
