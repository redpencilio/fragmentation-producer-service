import { Store, DataFactory, NamedNode } from "n3";
import { uuid } from "mu";

const { namedNode, quad, literal } = DataFactory;
/**
 * Yield the amount of solutions in the specified graph of the store.
 *
 * @param {Store} store Store containing all the triples.
 * @param {NamedNode} graph The graph containing the data.
 */
export function countVersionedItems(store: Store, stream: NamedNode): number {
  let count = store.countQuads(
    stream,
    namedNode("https://w3id.org/tree#member"),
    null,
    null
  );
  return count;
}

export function generateTreeRelation() {
  return namedNode(
    `http://mu.semte.ch/services/ldes-time-fragmenter/relations/${uuid()}`
  );
}

export function generatePageResource(number: number) {
  return namedNode(`/pages?page=${number}`);
}

export function nowLiteral() {
  const xsdDateTime = namedNode("http://www.w3.org/2001/XMLSchema#dateTime");
  const now = new Date().toISOString();
  return literal(now, xsdDateTime);
}

export function generateVersion(_namedNode: any) {
  return namedNode(
    `http://mu.semte.ch/services/ldes-time-fragmenter/versioned/${uuid()}`
  );
}
