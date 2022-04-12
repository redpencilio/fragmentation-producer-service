import { NamedNode, Store, Term } from "n3";

export default class Resource {
	id: Term;
	data: Store;

	constructor(id: Term, data: Store) {
		this.id = id;
		this.data = data;
	}
}
