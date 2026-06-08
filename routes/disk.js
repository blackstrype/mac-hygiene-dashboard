import express from 'express';
import { scanDirectory, openPath, deletePath } from '../services/diskService.js';

const router = express.Router();

router.get('/disk/scan', async (req, res) => {
  try {
    const data = await scanDirectory(req.query.path);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/disk/open', async (req, res) => {
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path is required' });
  try {
    await openPath(targetPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/disk/delete', async (req, res) => {
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path is required' });
  try {
    await deletePath(targetPath);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

export default router;
