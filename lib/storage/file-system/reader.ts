import fs from 'fs';
import jsstream from 'stream';
import * as RDF from 'rdf-js';
import Node from '../../models/node';
import path from 'path';

const ttl_read = require('@graphy/content.ttl.read');

import rdfParser from 'rdf-parse';

import rdfSerializer from 'rdf-serialize';
import { CONTEXT, FRAME } from '../../utils/context-jsonld';
import * as jsonld from 'jsonld';
import { BASE_FOLDER } from '../../utils/constants';
import { convertToNode } from '../../converters/node-converters';
import { createStore } from '../../utils/utils';

export async function convertToJsonLD(
  file: string,
  domainName: string
): Promise<jsonld.NodeObject> {
  try {
    const quadStream = readTriplesStream(
      file,
      domainName + path.relative(BASE_FOLDER, file)
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
    return jsonld.compact(jsonDoc, CONTEXT);
  } catch (e) {
    throw new Error(`Something went wrong while converting to JSON-LD: ${e}`);
  }
}

/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @return {Stream} Stream containing all triples which were downloaded.
 */

export function convert(
  file: string,
  contentType: string,
  domainName: string
): NodeJS.ReadableStream {
  const triplesStream = readTriplesStream(
    file,
    domainName + path.relative(BASE_FOLDER, file)
  );
  return rdfSerializer.serialize(triplesStream, {
    contentType: contentType,
  });
}

function readTriplesStream(file: string, baseIRI?: string): jsstream.Readable {
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

export async function readNode(filePath: string): Promise<Node> {
  try {
    const store = await createStore(readTriplesStream(filePath));
    return convertToNode(store);
  } catch (e) {
    throw new Error(`Something went wrong while converting file to node: ${e}`);
  }
}
