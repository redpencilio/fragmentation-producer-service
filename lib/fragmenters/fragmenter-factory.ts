import { Newable } from '../utils/utils';
import Fragmenter, { FragmenterArgs } from './fragmenter';
import TimeFragmenter from './time-fragmenter';

export const FRAGMENTER_MAP: Record<string, Newable<Fragmenter>> = {
  'time-fragmenter': TimeFragmenter,
  // 'prefix-tree-fragmenter': PrefixTreeFragmenter,
};

export function createFragmenter(name: string, args: FragmenterArgs) {
  if (name in FRAGMENTER_MAP) {
    return new FRAGMENTER_MAP[name](args);
  } else {
    throw new Error(`Fragmenter ${name} not found`);
  }
}
