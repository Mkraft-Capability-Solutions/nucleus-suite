/**
 * "app" catalog, English source of truth. Application shell: document title and description.
 * Every other locale file must match this shape (type AppMessages); keys are camelCase segments.
 */
import type { MessageTree } from '../../catalog';

const messages = {
  meta: {
    title: "Nucleus HRMS",
    description: "The intelligent workforce operating system.",
  },
} as const;

export type AppMessages = MessageTree<typeof messages>;
export default messages;
