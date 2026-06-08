import express from 'express';
import { getSystemStats } from '../services/macOSService.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
