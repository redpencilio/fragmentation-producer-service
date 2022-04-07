import { Store, Quad, NamedNode } from "n3";
import Fragmenter from "./Fragmenter";

export default class PrefixTreeFragmenter extends Fragmenter {
	addResource(
		resource_id: NamedNode<string>,
		resource_data: Store<Quad, Quad, Quad, Quad>
	): Promise<Store<Quad, Quad, Quad, Quad>> {
		throw new Error("Method not implemented.");
	}
	constructPageTemplate(): Store<Quad, Quad, Quad, Quad> {
		throw new Error("Method not implemented.");
	}
}
