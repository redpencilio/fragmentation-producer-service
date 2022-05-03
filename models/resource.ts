import { Term } from "@rdfjs/types";
import { Store } from "n3";
import * as RDF from "rdf-js";

export default class Resource {
	id: RDF.NamedNode;
	dataMap: Map<String, Term[]> = new Map();

	constructor(id: RDF.NamedNode, dataMap: Map<String, Term[]> = new Map()) {
		this.id = id;
		this.dataMap = dataMap;
	}

	addProperty(property: string, value: Term) {
		if (this.dataMap.has(property)) {
			this.dataMap.get(property).push(value);
		} else {
			this.dataMap.set(property, [value]);
		}
	}
}
