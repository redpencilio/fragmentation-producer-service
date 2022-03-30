import { Store, Quad, NamedNode, DataFactory } from "n3";
import { createStore, readTriplesStream } from "../storage/files";
import {
  generatePageResource,
  generateTreeRelation,
  generateVersion,
  nowLiteral,
} from "../utils";
import Fragmenter from "./Fragmenter";
const { namedNode, quad, literal } = DataFactory;

import * as RDF from "rdf-js";

const FEED_FILE = "/app/data/feed.ttl";
export default class TimeFragmenter extends Fragmenter {
  constructVersionedStore(store: Store, resource: NamedNode<string>): Store {
    const versionedResource = generateVersion(resource);
    const versionedStore = new Store();
    store.forEach(
      (quadObj) => {
        versionedStore.add(
          quad(
            quadObj.subject.equals(resource)
              ? versionedResource
              : quadObj.subject,
            quadObj.predicate.equals(resource)
              ? versionedResource
              : quadObj.predicate,
            quadObj.object.equals(resource) ? versionedResource : quadObj.object
          )
        );
      },
      null,
      null,
      null,
      null
    );

    const dateLiteral = nowLiteral();

    // add resources about this version
    versionedStore.add(
      quad(
        versionedResource,
        namedNode("http://purl.org/dc/terms/isVersionOf"),
        resource
      )
    );

    versionedStore.add(
      quad(
        versionedResource,
        namedNode("http://www.w3.org/ns/prov#generatedAtTime"),
        dateLiteral
      )
    );

    versionedStore.add(
      quad(
        this.stream,
        namedNode("https://w3id.org/tree#member"),
        versionedResource
      )
    );

    return versionedStore;
  }

  async closeDataset(store: Store, pageNr: number): Promise<Store> {
    try {
      const relationResource = generateTreeRelation();
      const currentPageResource = generatePageResource(pageNr);
      const nextPageResource = generatePageResource(pageNr + 1);
      store.add(
        quad(
          currentPageResource,
          namedNode("https://w3id.org/tree#relation"),
          relationResource
        )
      );
      store.add(
        quad(
          relationResource,
          namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
          namedNode("https://w3id.org/tree#GreaterThanOrEqualRelation")
        )
      );
      store.add(
        quad(
          relationResource,
          namedNode("https://w3id.org/tree#node"),
          nextPageResource
        )
      );
      store.add(
        quad(
          relationResource,
          namedNode("https://w3id.org/tree#path"),
          namedNode("http://www.w3.org/ns/prov#generatedAtTime")
        )
      );
      const dateLiteral = nowLiteral();
      store.add(
        quad(
          relationResource,
          namedNode("https://w3id.org/tree#value"),
          dateLiteral
        )
      );

      // create a store with the new graph for the new file
      const currentDataset = await createStore(readTriplesStream(FEED_FILE));

      currentDataset.add(
        quad(
          nextPageResource,
          namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
          namedNode("https://w3id.org/tree#Node")
        )
      );
      return currentDataset;
    } catch (e) {
      throw e;
    }
  }
}
