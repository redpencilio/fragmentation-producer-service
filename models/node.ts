import { NamedNode, Store, Term } from "n3";
import { rdf, tree } from "../utils/namespaces";

export default class Node {
	data: Store;

	constructor(data: Store) {
		this.data = data;
	}

	get id(): Term | null {
		const match = this.data.getQuads(null, rdf("type"), tree("Node"), null);
		if (match.length > 0) {
			console.log(match);
			return match[0].subject;
		}
		throw Error("Id not found!");
	}

	getRelations() {
		return this.data.getQuads(this.id, tree("relation"), null, null);
	}

	count() {
		return this.data.countQuads(null, tree("member"), null, null);
	}
}
