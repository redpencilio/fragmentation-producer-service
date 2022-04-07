import { Store, Quad, NamedNode, DataFactory } from "n3";
import Node from "../models/node";
import Resource from "../models/resource";
import {
	getNode,
	readTriplesStream,
	writeTriplesStream,
} from "../storage/files";
import { ldes, rdf, tree } from "../utils/namespaces";
import { getFirstMatch } from "../utils/utils";
import Fragmenter from "./Fragmenter";
const { namedNode, quad, literal } = DataFactory;

export default class PrefixTreeFragmenter extends Fragmenter {
	async addResource(resource: Resource): Promise<Node> {
		const viewFile = this.getViewFile();
		const viewNode = await getNode(readTriplesStream(viewFile));
		// Check if the view node exists, if not, create one
		return this._addResource(resource, viewNode);
	}

	async _addResource(resource: Resource, node: Node): Promise<Node> {
		// Check if we have to add the resource to a child of the current node, to the current node itself or if we have to split the current node.
		const children = node.getRelations();
		if (children.length > 0) {
			children.forEach(async (childRelation) => {
				if (childRelation.type.equals(tree("PrefixRelation"))) {
					// The current node contains a child with a prefix relation
					const resourceTermValue = getFirstMatch(
						resource.data,
						resource.id,
						childRelation.path,
						null,
						null
					)?.object;
					if (
						resourceTermValue &&
						resourceTermValue.value.startsWith(
							childRelation.value.value
						)
					) {
						// The to be added resource matches the prefix
						const childNode = await getNode(
							readTriplesStream(childRelation.target.value)
						);
						return this._addResource(resource, childNode);
					}
				}
			});
			// The current node has children, check if any of the relations match with the to be added resource
		} else {
			// Add the resource to the current node, if it is full: split.
			if (this.shouldCreateNewPage(node)) {
				// the current node has to be splitted
			} else {
				// we can simply add the new resource to the current node as a member
				node.data.addQuads(
					resource.data.getQuads(null, null, null, null)
				);
				if (node.id?.value) {
					await writeTriplesStream(node.data, node.id?.value);
				}
			}
		}
		return node;
	}

	constructNewNode(): Node {
		const store = new Store();
		const subject = this.stream;
		store.addQuad(subject, rdf("type"), ldes("EventStream"));
		store.addQuad(subject, rdf("type"), tree("Collection"));
		store.addQuad(subject, tree("view"), namedNode(`${this.folder}/1`));
		return new Node(store);
	}
}
