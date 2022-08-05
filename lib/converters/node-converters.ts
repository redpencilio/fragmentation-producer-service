import { Store, DataFactory } from 'n3';
import Node, { Metadata } from '../models/node';
import { LDES, RDF_NAMESPACE, TREE } from '../utils/namespaces';
import { getFirstMatch, pushToReadable } from '../utils/utils';
import * as RDF from 'rdf-js';
import path from 'path';
import Relation from '../models/relation';
import Member from '../models/member';
import stream from 'stream';
const { quad } = DataFactory;
export function convertToStream(node: Node) {
  const quadStream = new stream.Readable({ objectMode: true });
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
    pushToReadable(quadStream, ...member.data.getQuads(null, null, null, null));
  });

  quadStream.push(null);
  return quadStream;
}

export function convertToNode(store: Store) {
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
  const subjectsToQuadsMapping = new Map<RDF.Quad_Subject, RDF.Quad[]>();
  store.forEach(
    (quad) => {
      if (subjectsToQuadsMapping.has(quad.subject)) {
        subjectsToQuadsMapping.get(quad.subject)!.push(quad);
      } else {
        subjectsToQuadsMapping.set(quad.subject, [quad]);
      }
    },
    null,
    null,
    null,
    null
  );
  const handledSubjects: Set<string> = new Set();
  const members: Member[] = [];
  const memberIds = store.getObjects(null, TREE('member'), null);
  memberIds.forEach((memberId) => {
    const member = extractMember(
      memberId as RDF.NamedNode,
      store,
      handledSubjects
    );
    members.push(member);
  });
  return members;
}

function extractMember(
  memberId: RDF.NamedNode,
  store: Store,
  handledSubjects: Set<string>
) {
  const member = new Member(memberId as RDF.NamedNode);
  const queue: RDF.Quad_Subject[] = [memberId];
  while (queue.length > 0) {
    const subject = queue.pop();
    if (subject && !handledSubjects.has(subject.value)) {
      handledSubjects.add(subject.value);
      store.getQuads(subject, null, null, null).forEach((quad) => {
        member.addQuads(quad);
        if (
          (quad.object.termType === 'BlankNode' ||
            quad.object.termType === 'NamedNode') &&
          !handledSubjects.has(quad.object.value)
        ) {
          queue.push(quad.object);
        }
      });
    }
  }
  return member;
}
