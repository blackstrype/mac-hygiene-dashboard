import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { scanDirectory, openPath, deletePath } from '../services/diskService.js';
import { getFilePreview } from '../utils/sysUtils.js';
import { analyzeFileUtility } from '../services/aiService.js';
import { home } from '../config/paths.js';

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

router.post('/disk/analyze', async (req, res) => {
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(412).json({
      error: 'GEMINI_API_KEY is not set.',
      instructions: 'Please configure the GEMINI_API_KEY environment variable in your terminal environment and restart the ZenMac server to enable AI file analysis.'
    });
  }

  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(home)) {
    return res.status(403).json({ error: 'Access Denied: Cannot analyze files outside user home directory.' });
  }

  try {
    const stats = await fs.stat(resolved);
    const isDirectory = stats.isDirectory();
    const size = stats.size;
    const name = path.basename(resolved);
    
    let previewText = '';
    if (!isDirectory) {
      previewText = await getFilePreview(resolved, 1000);
    }
    
    const analysis = await analyzeFileUtility(resolved, name, size, previewText);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
