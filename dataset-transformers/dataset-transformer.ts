import { Readable, Stream, PassThrough } from "stream";

import { DatasetConfiguration } from "../utils/utils";

export default interface DatasetTransformer {
	transform(input: Readable, config: DatasetConfiguration): Readable;
}
