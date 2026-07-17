import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getProcesses, killProcess, getProcessInfo } from '../services/macOSService.js';
import { execAsync } from '../utils/sysUtils.js';
import { diagnoseProcessCPU } from '../services/aiService.js';

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

router.post('/processes/diagnose', async (req, res) => {
  const { pid, name } = req.body;
  if (!pid) return res.status(400).json({ error: 'PID is required' });
  if (!name) return res.status(400).json({ error: 'Process name is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(412).json({
      error: 'GEMINI_API_KEY is not set.',
      instructions: 'Please configure the GEMINI_API_KEY environment variable in your terminal environment and restart the ZenMac server to enable AI CPU diagnostics.'
    });
  }

  const tempPath = path.join(process.cwd(), `temp_sample_${pid}.txt`);

  try {
    // Run macOS sample command for 1 second
    await execAsync(`sample ${pid} 1 -file "${tempPath}"`);
    const content = await fs.readFile(tempPath, 'utf8');
    await fs.unlink(tempPath).catch(() => {});

    const callGraphText = content.substring(0, 30000);
    const diagnosis = await diagnoseProcessCPU(pid, name, callGraphText);
    res.json(diagnosis);
  } catch (error) {
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});
    console.error(`Error during CPU diagnosis for PID ${pid}:`, error.message);

    const errorMsg = error.message;
    if (errorMsg.includes('Authorization') || errorMsg.includes('privilege') || errorMsg.includes('root') || errorMsg.includes('not permit')) {
      return res.status(403).json({ 
        error: 'Permission Denied: Sampling system processes owned by root requires administrator privileges. Diagnostics are restricted to user-owned processes.'
      });
    }
    res.status(500).json({ error: `Failed to diagnose process: ${errorMsg}` });
  }
});

export default router;

