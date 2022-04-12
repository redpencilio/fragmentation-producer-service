import { Store } from "n3";
import * as RDF from "rdf-js";

export default class Resource {
	id: RDF.NamedNode;
	data: Store;

	constructor(id: RDF.NamedNode, data: Store) {
		this.id = id;
		this.data = data;
	}
}
