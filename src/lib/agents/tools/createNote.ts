// ============================================================================
// Built-in Tool: create_note
// ============================================================================
// Creates a new note in LocAI's note storage system.
// Uses the same FileNoteStorage as the rest of the app.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import { FileNoteStorage } from '../../notes/fileNoteStorage';
import { resolveNotesBasePath } from '../../settings/store';

/**
 * Resolve the notes base path.
 * Priority: settings.notesPath > LOCAL_NOTES_PATH env > ~/.locai/notes/
 */
function resolveNotesPath(): string | null {
  const resolved = resolveNotesBasePath();
  return resolved || null;
}

const createNoteTool: RegisteredTool = {
  definition: {
    name: 'create_note',
    description:
      'Create a new note in the user\'s LocAI notes. ' +
      'The note will be saved as a markdown file and can be found in the Notes section. ' +
      'Use this when the user asks to save, note down, or remember something.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the note',
        },
        content: {
          type: 'string',
          description: 'Markdown content of the note',
        },
      },
      required: ['title', 'content'],
    },
    enabled: true,
    category: 'notes',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const title = args.title as string | undefined;
    const content = args.content as string | undefined;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "title" is required and must be a non-empty string. ' +
          'Expected: create_note(title: "Meine Notiz", content: "Notizinhalt"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    if (!content || typeof content !== 'string') {
      return {
        callId,
        content: '',
        error:
          'Parameter "content" is required and must be a string. ' +
          'Expected: create_note(title: "Meine Notiz", content: "Notizinhalt"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    const basePath = resolveNotesPath();
    if (!basePath) {
      return {
        callId,
        content: '',
        error:
          'Notes path could not be resolved. Configure notesPath in Settings or set LOCAL_NOTES_PATH.',
        success: false,
      };
    }

    try {
      const storage = new FileNoteStorage(basePath);
      const note = await storage.saveNote({
        title: title.trim(),
        content,
      });

      return {
        callId,
        content: `Note created successfully:\n- ID: ${note.id}\n- Title: ${note.title}\n- Tags: ${note.tags.length > 0 ? note.tags.join(', ') : 'none'}\n- Created: ${note.createdAt}`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create note';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default createNoteTool;
