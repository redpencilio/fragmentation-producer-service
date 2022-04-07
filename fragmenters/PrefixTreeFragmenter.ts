import { Store, Quad, NamedNode } from "n3";
import Node from "../models/node";
import Resource from "../models/resource";
import Fragmenter from "./Fragmenter";

export default class PrefixTreeFragmenter extends Fragmenter {
	addResource(resource: Resource): Promise<Node> {
		throw new Error("Method not implemented.");
	}
	constructNewNode(): Node {
		throw new Error("Method not implemented.");
	}
}
