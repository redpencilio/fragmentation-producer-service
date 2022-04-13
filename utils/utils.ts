import { Store, DataFactory, Quad, OTerm } from "n3";
import { uuid } from "mu";
import { ldesTime, tree, xml } from "./namespaces";
import * as RDF from "rdf-js";
const { namedNode, quad, literal } = DataFactory;

export type QuadElement =
	| RDF.Quad_Subject
	| RDF.Quad_Predicate
	| RDF.Quad_Object;

export function generateTreeRelation() {
	return ldesTime(`relations/${uuid()}`);
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

export function getFirstMatch(
	store: Store,
	subject?: OTerm,
	predicate?: OTerm,
	object?: OTerm,
	graph?: OTerm
): Quad | null {
	const matches = store.getQuads(
		subject || null,
		predicate || null,
		object || null,
		graph || null
	);
	if (matches.length > 0) {
		return matches[0];
	}
	return null;
}
