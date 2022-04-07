import { Store, DataFactory, NamedNode } from "n3";
import { uuid } from "mu";
import { ldesTime, tree, xml } from "./namespaces";
import * as RDF from "rdf-js";
const { namedNode, quad, literal } = DataFactory;
/**
 * Yield the amount of solutions in the specified graph of the store.
 *
 * @param {Store} store Store containing all the triples.
 * @param {NamedNode} graph The graph containing the data.
 */
export function countVersionedItems(
	store: Store,
	stream: RDF.NamedNode
): number {
	let count = store.countQuads(stream, tree("member"), null, null);
	return count;
}

export function generateTreeRelation() {
	return ldesTime(`relations/${uuid()}`);
}

export function generatePageResource(number: number) {
	return namedNode(`/pages?page=${number}`);
}

export function nowLiteral() {
	const xsdDateTime = xml("dateTime");
	const now = new Date().toISOString();
	return literal(now, xsdDateTime);
}

export function generateVersion(_namedNode: any) {
	return ldesTime(`versioned/${uuid()}`);
}

export function error(status: number, msg?: string) {
	var err = new Error(msg || "An error occurred");
	err.status = status;
	return err;
}
