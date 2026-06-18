import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createArtifact,
  createProject,
  createSavepoint,
  createRunLedgerEntry,
  completeRunLedgerEntry,
  deleteArtifact,
  deleteProject,
  getArtifact,
  getRunLedgerEntry,
  listArtifacts,
  listProjects,
  listRunLedgerEntries,
  listSavepoints,
  updateArtifact,
  updateProject,
} from './store';

describe('workspace store', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'locai-workspace-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('persists projects and artifacts under the workspace root', async () => {
    const project = await createProject(
      { name: 'Test Project', description: 'Local artifact work', tags: ['ai', 'ai'] },
      root,
    );

    expect(project.name).toBe('Test Project');
    expect(project.tags).toEqual(['ai']);
    expect(await listProjects(root)).toHaveLength(1);

    const updatedProject = await updateProject(project.id, { name: 'Updated Project' }, root);
    expect(updatedProject?.name).toBe('Updated Project');

    const artifact = await createArtifact(
      {
        projectId: project.id,
        title: 'Research Brief',
        type: 'research_brief',
        content: '# Research Brief\n\nFindings.',
      },
      root,
    );

    expect(artifact.content).toContain('Findings');
    expect(await listArtifacts(project.id, root)).toHaveLength(1);

    const loaded = await getArtifact(artifact.id, root);
    expect(loaded?.title).toBe('Research Brief');
    expect(loaded?.content).toContain('Findings');

    const updatedArtifact = await updateArtifact(
      artifact.id,
      { title: 'Final Brief', content: '# Final Brief' },
      root,
    );
    expect(updatedArtifact?.title).toBe('Final Brief');
    expect(updatedArtifact?.content).toBe('# Final Brief');

    const savepoint = await createSavepoint(artifact.id, 'Initial review', 'user', root);
    expect(savepoint?.reason).toBe('Initial review');
    expect((await getArtifact(artifact.id, root))?.savepointIds).toEqual([savepoint?.id]);
    expect(await listSavepoints(artifact.id, root)).toHaveLength(1);

    const ledger = await createRunLedgerEntry(
      {
        projectId: project.id,
        artifactId: artifact.id,
        requestSummary: 'Read project source',
        toolId: 'read_file',
        toolSource: 'builtin',
        capabilityScopes: ['read_local_files'],
        approvalPolicy: 'none',
        approvalDecision: 'not_required',
        redactedArguments: { path: 'brief.md' },
      },
      root,
    );

    expect((await listRunLedgerEntries(project.id, artifact.id, root))[0].id).toBe(ledger.id);
    expect((await getArtifact(artifact.id, root))?.runIds).toEqual([ledger.id]);

    const completed = await completeRunLedgerEntry(
      ledger.id,
      { success: true, redactedResult: { content: 'ok' } },
      root,
    );
    expect(completed?.success).toBe(true);
    expect((await getRunLedgerEntry(ledger.id, root))?.redactedResult).toEqual({ content: 'ok' });

    expect(await deleteArtifact(artifact.id, root)).toBe(true);
    expect(await listArtifacts(project.id, root)).toEqual([]);
    expect(await deleteProject(project.id, root)).toBe(true);
    expect(await listProjects(root)).toEqual([]);
  });
});
