import fs from 'fs';
import { Quad, Store, DataFactory, Quad_Object } from 'n3';
const { quad, namedNode } = DataFactory;
import jsstream from 'stream';
import * as RDF from 'rdf-js';
import Node from '../models/node';
import { getFirstMatch } from '../utils/utils';
import {
  LDES,
  RDF_NAMESPACE as RDF_NAMESPACE,
  TREE,
} from '../utils/namespaces';
import Resource from '../models/resource';
import Relation from '../models/relation';
import path from 'path';

const ttl_read = require('@graphy/content.ttl.read');
const ttl_write = require('@graphy/content.ttl.write');

import rdfSerializer from 'rdf-serialize';

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
  const triplesStream = readTriplesStream(file);
  return rdfSerializer.serialize(triplesStream, {
    contentType: contentType,
  });
}

export function readTriplesStream(file: string): jsstream.Readable {
  if (!fs.existsSync(file)) {
    throw Error(`File does not exist: ${file}`);
  }
  const fileStream = fs.createReadStream(file);

  return fileStream.pipe(ttl_read());
}

export function createStore(quadStream: RDF.Stream<Quad>): Promise<Store> {
  const store = new Store();
  return new Promise((resolve, reject) =>
    store
      .import(quadStream)
      .on('error', reject)
      .once('end', () => resolve(store))
  );
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
/**
 * Writes the triples in text-turtle to a file.
 *
 * @param {Store} store The store from which content will be written.
 * @param {NamedNode} graph The graph which will be written to the file.
 * @param {string} file Path of the file to which we will write the content.
 */
export async function writeTriplesStream(
  quadStream: jsstream.Readable,
  file: string
): Promise<void> {
  await createParentFolderIfNecessary(file);
  const turtleStream = quadStream.pipe(ttl_write());
  const writeStream = fs.createWriteStream(file);

  turtleStream.on('data', (turtleChunk: any) => {
    // turtleStream.pause();
    writeStream.write(turtleChunk);
    // turtleStream.resume();
  });
  return new Promise((resolve, reject) => {
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

export async function readNode(filePath: string): Promise<Node> {
  const triplesStream = readTriplesStream(filePath);
  let store = await createStore(triplesStream);

  let id = getFirstMatch(
    store,
    null,
    RDF_NAMESPACE('type'),
    TREE('Node')
  )?.subject;
  const stream = getFirstMatch(
    store,
    null,
    RDF_NAMESPACE('type'),
    LDES('EventStream')
  )?.subject;
  let view = getFirstMatch(store, null, TREE('view'))?.object;
  if (id && stream && view) {
    let node: Node = new Node(
      parseInt(path.parse(id.value).base),
      stream as RDF.NamedNode,
      view as RDF.NamedNode
    );

    // Read relations from store and add them to the node
    const relationIds = store
      .getQuads(id, TREE('relation'), null, null)
      .map((quad) => quad.object);

    relationIds.forEach((relationId) => {
      let type = getFirstMatch(
        store,
        relationId,
        RDF_NAMESPACE('type')
      )?.object;

      let value = getFirstMatch(store, relationId, TREE('value'))?.object;

      let target = getFirstMatch(store, relationId, TREE('node'))?.object;

      let relationPath = getFirstMatch(store, relationId, TREE('path'))?.object;

      if (type && value && target && relationPath) {
        node.add_relation(
          value.value,
          new Relation(
            relationId as RDF.NamedNode,
            type as RDF.NamedNode,
            value as RDF.Literal,
            target as RDF.NamedNode,
            parseInt(path.parse(target.value).base),
            relationPath as RDF.NamedNode
          )
        );
      }
    });
    // Read members from store and add them to the node
    const memberIds = store
      .getQuads(null, TREE('member'), null, null)
      .map((quad) => quad.object);
    memberIds.forEach((memberId) => {
      let content = new Store(store.getQuads(memberId, null, null, null));
      let resource = new Resource(memberId as RDF.NamedNode);
      content.forEach(
        (quad) => {
          resource.addProperty(quad.predicate.value, quad.object);
        },
        null,
        null,
        null,
        null
      );
      node.add_member(resource);
    });

    return node;
  } else {
    throw Error(
      'Reference to id, stream or view not found in the requested file'
    );
  }
}

export async function writeNode(node: Node, path: string) {
  const quadStream = new jsstream.PassThrough({ objectMode: true });

  await createParentFolderIfNecessary(path);
  const turtleStream = quadStream.pipe(ttl_write());
  const writeStream = fs.createWriteStream(path);

  turtleStream.on('data', (turtleChunk: any) => {
    writeStream.write(turtleChunk);
  });

  quadStream.push(
    quad(node.stream, RDF_NAMESPACE('type'), LDES('EventStream'))
  );
  quadStream.push(quad(node.stream, RDF_NAMESPACE('type'), TREE('Collection')));
  quadStream.push(quad(node.stream, TREE('view'), node.view));

  quadStream.push(quad(node.idNamedNode, RDF_NAMESPACE('type'), TREE('Node')));

  // Add the different relations to the store
  node.relationsMap.forEach((relation, _) => {
    quadStream.push(quad(node.idNamedNode, TREE('relation'), relation.id));
    quadStream.push(quad(relation.id, RDF_NAMESPACE('type'), relation.type));
    quadStream.push(quad(relation.id, TREE('value'), relation.value));
    quadStream.push(quad(relation.id, TREE('node'), relation.target));
    quadStream.push(quad(relation.id, TREE('path'), relation.path));
  });

  // Add the different members and their data to the store
  node.members.forEach((member) => {
    quadStream.push(quad(node.stream, TREE('member'), member.id));
    member.dataMap.forEach((objects, predicateValue) => {
      objects.forEach((object) => {
        quadStream.push(
          quad(
            member.id,
            namedNode(predicateValue.toString()),
            object as Quad_Object
          )
        );
      });
    });
  });

  quadStream.push(null);

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
