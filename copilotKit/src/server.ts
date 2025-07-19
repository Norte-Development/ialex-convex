import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Determine the root directory of the backend
// __dirname in an ES module setup with ts-node might behave differently or not be available.
// A more robust way if __dirname is not defined, or for ES modules in general:
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.resolve(__dirname, '..'); // Assuming src is one level down from backend root

// Path to .env.local and .env
const envLocalPath = path.join(backendDir, '.env.local');
const envPath = path.join(backendDir, '.env');

// Load .env.local if it exists
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  // Otherwise, load .env if it exists
  dotenv.config({ path: envPath });
  console.log('Loaded environment variables from .env');
} else {
  console.warn("No .env or .env.local file found. Ensure OPENAI_API_KEY is set in your environment.");
}

import express from 'express';
import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';

 
const app = express();

const serviceAdapter = new EmptyAdapter();

 
app.use('/copilotkit', (req, res, next) => {
  (async () => {
    const runtime = new CopilotRuntime({
      remoteEndpoints: [{url: 'http://localhost:8000/chat', agents: [{name: 'memory_agent', description: 'Sos un asistente IA que recuerda tus conversaciones'}]}]
    });
    const handler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilotkit',
      runtime,
      serviceAdapter,
    });
    
    return handler(req, res);
  })().catch(next);
});
 
app.listen(4000, () => {
  console.log('Listening at http://localhost:4000/copilotkit');
});