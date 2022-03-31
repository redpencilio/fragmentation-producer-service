import { NamedNode, Store } from "n3";

import {
  clearLastPageCache,
  createStore,
  lastPage,
  readTriplesStream,
  writeTriplesStream,
} from "../storage/files.js";
import { countVersionedItems } from "../utils/utils.js";

export default abstract class Fragmenter {
  folder: string;
  maxResourcesPerPage: number;
  stream: NamedNode;

  constructor(folder: string, stream: NamedNode, maxResourcesPerPage: number) {
    this.folder = folder;
    this.stream = stream;
    this.maxResourcesPerPage = maxResourcesPerPage;
  }
  abstract constructVersionedStore(store: Store, resource: NamedNode): Store;

  abstract closeDataset(store: Store, pageNr: number): Promise<Store>;

  abstract constructPageTemplate(): Store;

  fileForPage(pageNr: number): string {
    return `${this.folder}/${pageNr}.ttl`;
  }

  shouldCreateNewPage(store: Store): boolean {
    return countVersionedItems(store, this.stream) >= this.maxResourcesPerPage;
  }

  async writeVersionedResource(versionedStore: Store): Promise<Store> {
    try {
      const lastPageNr = lastPage(this.folder);
      let pageFile = this.fileForPage(lastPageNr);

      let currentDataset = await createStore(readTriplesStream(pageFile));

      if (this.shouldCreateNewPage(currentDataset)) {
        const closingDataset = currentDataset;

        // link the current dataset to the new dataset but don't save yet
        const closingPageFile = pageFile;
        const nextPageFile = this.fileForPage(lastPageNr + 1);

        // create a store with the new graph for the new file
        currentDataset = await this.closeDataset(closingDataset, lastPageNr);

        currentDataset.addQuads(
          versionedStore.getQuads(null, null, null, null)
        );

        // // Write out new dataset to nextPageFile
        await writeTriplesStream(currentDataset, nextPageFile);
        // // Write out closing dataset to closingPageFile
        await writeTriplesStream(closingDataset, closingPageFile);
        // Clear the last page cache
        clearLastPageCache(this.folder);
      } else {
        currentDataset.addQuads(
          versionedStore.getQuads(null, null, null, null)
        );
        await writeTriplesStream(currentDataset, pageFile);
      }
      return currentDataset;
    } catch (e) {
      throw e;
    }
  }

  async fragment(store: Store, resource: NamedNode): Promise<Store> {
    const versionedStore: Store = await this.constructVersionedStore(
      store,
      resource
    );
    const lastDataset = await this.writeVersionedResource(versionedStore);
    return lastDataset;
  }
}
