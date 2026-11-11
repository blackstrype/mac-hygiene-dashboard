import express from 'express';
import {
  listCloudDestinations,
  offloadToCloud,
  findDuplicates,
  removeDuplicates
} from '../services/storageService.js';
import { localOnly } from '../utils/localOnly.js';

const router = express.Router();

// Everything here moves or removes user files: same-machine requests only
router.use('/storage', localOnly);

function sendError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status === 500) console.error('Storage operation failed:', error);
  res.status(status).json({ error: error.message });
}

router.get('/storage/destinations', async (req, res) => {
  try {
    res.json({ destinations: await listCloudDestinations() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/storage/offload', async (req, res) => {
  const { path: targetPath, destination } = req.body || {};
  if (!targetPath || !destination) {
    return res.status(400).json({ error: 'Path and destination are required' });
  }
  try {
    res.json(await offloadToCloud(targetPath, destination));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/storage/duplicates/scan', async (req, res) => {
  const { path: targetPath, minSize } = req.body || {};
  try {
    res.json(await findDuplicates(targetPath, minSize));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/storage/duplicates/remove', async (req, res) => {
  try {
    res.json(await removeDuplicates(req.body?.groups));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
