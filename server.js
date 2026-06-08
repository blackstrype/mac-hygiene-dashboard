import express from 'express';
import path from 'path';

// Import route modules
import statsRouter from './routes/stats.js';
import processesRouter from './routes/processes.js';
import focusRouter from './routes/focus.js';
import cleanRouter from './routes/clean.js';
import diskRouter from './routes/disk.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(process.cwd(), 'public')));

// Mount API routes
app.use('/api', statsRouter);
app.use('/api', processesRouter);
app.use('/api', focusRouter);
app.use('/api', cleanRouter);
app.use('/api', diskRouter);

// Start listening
app.listen(PORT, () => {
  console.log(`ZenMac dashboard backend running on http://localhost:${PORT}`);
});
