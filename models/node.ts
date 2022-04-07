import { Store } from "n3";

export default class Node {
	data: Store;

	constructor(data: Store) {
		this.data = data;
	}
}
