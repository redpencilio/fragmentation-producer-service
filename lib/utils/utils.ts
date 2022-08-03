import { Store, DataFactory, Quad, OTerm } from 'n3';
import { v4 as uuid } from 'uuid';
import { LDES_TIME, XML } from './namespaces';
import * as RDF from 'rdf-js';
const { literal } = DataFactory;

interface Error {
  name: string;
  message: string;
  status?: number;
}

export type QuadElement =
  | RDF.Quad_Subject
  | RDF.Quad_Predicate
  | RDF.Quad_Object;

export function generateTreeRelation() {
  return LDES_TIME(`relations/${uuid()}`);
}

export function nowLiteral() {
  const xsdDateTime = XML('dateTime');
  const now = new Date().toISOString();
  return literal(now, xsdDateTime);
}

export function generateVersion(_namedNode: any) {
  return LDES_TIME(`versioned/${uuid()}`);
}

export function error(status: number, msg?: string) {
  const err: Error = new Error(msg || 'An error occurred');
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

/**
 * Yields the file path on which the specified page number is described.
 *
 * @param {number} page Page index for which we want te get the file path.
 * @return {string} Path to the page.
 */
export function fileForPage(folder: string, page: number): string {
  return `${folder}/${page}.ttl`;
}

export type Newable<T> = { new (...args: any[]): T };
