import fs from 'fs';
import { Quad, Store, DataFactory, Quad_Object } from 'n3';
const { quad, namedNode } = DataFactory;
import jsstream from 'stream';
import * as RDF from 'rdf-js';
import Node, { Metadata } from '../models/node';
import { getFirstMatch, pushToReadable } from '../utils/utils';
import { LDES, RDF_NAMESPACE, TREE } from '../utils/namespaces';
import Member from '../models/member';
import Relation from '../models/relation';
import path from 'path';

const ttl_write = require('@graphy/content.ttl.write');

import rdfParser from 'rdf-parse';

import rdfSerializer from 'rdf-serialize';
import { FRAME } from '../utils/context-jsonld';
import * as jsonld from 'jsonld';
import { BASE_FOLDER, DOMAIN_NAME } from '../utils/constants';

export async function convertToJsonLD(file: string): Promise<any> {
  const quadStream = readTriplesStream(file);
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
  const baseIRI = path.join(DOMAIN_NAME, path.relative(BASE_FOLDER, file));
  return rdfParser.parse(fileStream, {
    contentType: 'text/turtle',
    baseIRI: baseIRI,
  });
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

export async function readNode(filePath: string): Promise<Node> {
  const store = await createStore(readTriplesStream(filePath));

  // Read metadata from store and create a node from it
  const node: Node = new Node(extractMetadata(store));

  // Read relations from store and add them to the node
  const relations = extractRelations(store);
  node.add_relations(...relations);

  // Read members from store and add them to the node
  const members = extractMembers(store);
  node.add_members(...members);

  return node;
}

export async function writeNode(node: Node, path: string) {
  const quadStream = new jsstream.PassThrough({ objectMode: true });

  await createParentFolderIfNecessary(path);
  const turtleStream = quadStream.pipe(ttl_write());
  const writeStream = fs.createWriteStream(path);

  turtleStream.on('data', (turtleChunk: any) => {
    writeStream.write(turtleChunk);
  });

  pushToReadable(
    quadStream,
    ...[
      quad(node.metadata.stream, RDF_NAMESPACE('type'), LDES('EventStream')),
      quad(node.metadata.stream, RDF_NAMESPACE('type'), TREE('Collection')),
      quad(node.metadata.stream, TREE('view'), node.metadata.view),
      quad(node.idNamedNode, RDF_NAMESPACE('type'), TREE('Node')),
    ]
  );

  // Add the different relations to the store
  node.relationsMap.forEach((relation) => {
    pushToReadable(
      quadStream,
      ...[
        quad(node.idNamedNode, TREE('relation'), relation.id),
        quad(relation.id, RDF_NAMESPACE('type'), relation.type),
        quad(relation.id, TREE('value'), relation.value),
        quad(relation.id, TREE('node'), relation.target),
        quad(relation.id, TREE('path'), relation.path),
      ]
    );
  });

  // Add the different members and their data to the store
  node.members.forEach((member) => {
    quadStream.push(quad(node.metadata.stream, TREE('member'), member.id));
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

function extractMetadata(store: Store): Metadata {
  const id = getFirstMatch(
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
  const view = getFirstMatch(store, null, TREE('view'))?.object;
  if (id && stream && view) {
    return {
      id: parseInt(path.parse(id.value).base),
      stream: stream as RDF.NamedNode,
      view: view as RDF.NamedNode,
    };
  } else {
    throw Error('Reference to id, stream or view not found');
  }
}

function extractRelations(store: Store): Relation[] {
  const relations: Relation[] = [];
  store.forObjects(
    (relationId) => {
      const type = getFirstMatch(
        store,
        relationId,
        RDF_NAMESPACE('type')
      )?.object;

      const value = getFirstMatch(store, relationId, TREE('value'))?.object;

      const target = getFirstMatch(store, relationId, TREE('node'))?.object;

      const relationPath = getFirstMatch(
        store,
        relationId,
        TREE('path')
      )?.object;

      if (type && value && target && relationPath) {
        relations.push(
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
    },
    null,
    TREE('relation'),
    null
  );
  return relations;
}

function extractMembers(store: Store): Member[] {
  const members: Member[] = [];
  store.forObjects(
    (memberId) => {
      const content = new Store(store.getQuads(memberId, null, null, null));
      const member = new Member(memberId as RDF.NamedNode);
      content.forEach(
        (quad) => {
          member.addProperty(quad.predicate.value, quad.object);
        },
        null,
        null,
        null,
        null
      );
    },
    null,
    TREE('member'),
    null
  );
  return members;
}
