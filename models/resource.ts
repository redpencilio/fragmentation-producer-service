import { NamedNode, Store } from "n3";

export default class Resource {
	id: NamedNode;
	data: Store;

	constructor(id: NamedNode, data: Store) {
		this.id = id;
		this.data = data;
	}
}
