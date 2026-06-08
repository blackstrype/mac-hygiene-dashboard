import express from 'express';
import { scanCaches, runCacheClean } from '../services/diskService.js';

const router = express.Router();

router.get('/clean/scan', async (req, res) => {
  try {
    const results = await scanCaches();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clean/run', async (req, res) => {
  const { caches } = req.body;
  if (!caches || !Array.isArray(caches)) {
    return res.status(400).json({ error: 'Caches array is required' });
  }
  try {
    const result = await runCacheClean(caches);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
