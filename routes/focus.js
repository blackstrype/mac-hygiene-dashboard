import express from 'express';
import { getFocusStatus, setFocusPreset } from '../services/macOSService.js';

const router = express.Router();

router.get('/focus/status', async (req, res) => {
  try {
    const status = await getFocusStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/focus/preset', async (req, res) => {
  const { preset } = req.body;
  if (!preset) return res.status(400).json({ error: 'Preset is required' });
  try {
    const result = await setFocusPreset(preset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
