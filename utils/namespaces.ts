import namespace from "@rdfjs/namespace";
import { DataFactory } from "n3";

function n3Namespace(uri: string) {
	return namespace(uri, { factory: DataFactory });
}

export const example = n3Namespace("https://example.org/");

export const tree = n3Namespace("https://w3id.org/tree#");

export const xml = n3Namespace("http://www.w3.org/2001/XMLSchema#");

export const ldes = n3Namespace("http://w3id.org/ldes#");

export const ldesTime = n3Namespace(
	"http://mu.semte.ch/services/ldes-time-fragmenter/"
);

export const prov = n3Namespace("http://www.w3.org/ns/prov#");

export const rdf = n3Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");

export const purl = n3Namespace("http://purl.org/dc/terms/");
