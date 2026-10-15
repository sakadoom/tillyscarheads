import { Router } from 'express';
import { buildProjectAnalysis } from 'shared';

import { currentUserId } from '../middleware/auth.js';
import { getOwnedProject } from '../services/ownership.js';
import { routeParam } from '../services/request.js';
import { getProjectSnapshot } from '../services/snapshot.js';

export const analysisRouter = Router();

analysisRouter.get('/projects/:id/analysis', async (req, res) => {
  const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
  const snapshot = await getProjectSnapshot(project.id);

  const analysis = buildProjectAnalysis({
    project: snapshot.project,
    tasks: snapshot.tasks,
    dependencies: snapshot.dependencies,
    resources: snapshot.resources,
    assignments: snapshot.assignments,
    holidays: snapshot.holidays,
  });

  res.json(analysis);
});
