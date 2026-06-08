import express from 'express';
import { getProcesses, killProcess, getProcessInfo } from '../services/macOSService.js';

const router = express.Router();

router.get('/processes', async (req, res) => {
  try {
    const data = await getProcesses();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/processes/kill', async (req, res) => {
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: 'PID is required' });
  try {
    await killProcess(pid);
    res.json({ success: true, message: `Process ${pid} terminated.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/processes/info', (req, res) => {
  const { name, comm } = req.query;
  if (!name) return res.status(400).json({ error: 'Process name is required' });
  const info = getProcessInfo(name, comm);
  res.json(info);
});

export default router;
