import { GoogleGenerativeAI } from '@google/generative-ai';

export async function analyzeFileUtility(filePath, fileName, fileSize, previewText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `
You are ZenMac AI, a macOS resource hygiene assistant.
A user has found a file or folder on their Mac inside the Disk Usage Analyzer and wants to know if they can safely delete it to reclaim disk space.
Analyze the following item details:
- Name: ${fileName}
- Path: ${filePath}
- Size (Bytes): ${fileSize}
- Content Preview (first 1KB, if file):
"""
${previewText || 'No preview available (this is a directory or binary file)'}
"""

Determine if this file/folder is critical to system operations, app settings, active developer operations, or if it is temporary and safe to delete.

Provide your assessment in a structured JSON response matching this schema:
{
  "classification": string (A clear classification of the file/folder type/origin, e.g., "Gradle Daemon Log", "Yarn Cache Folder"),
  "purpose": string (A concise 1-2 sentence description explaining what this item is and what application generated it),
  "safeness": number (An integer score from 0 to 100, where 0 means "System critical, do not delete" and 100 means "Completely safe to delete"),
  "assessment": string (A clear deletion advisory statement, explaining the consequences of deleting it and why it is safe or unsafe)
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonText = response.text();
  
  try {
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error('Error parsing Gemini response:', jsonText);
    throw new Error('Failed to parse AI analysis response.');
  }
}

export async function diagnoseProcessCPU(pid, processName, callGraphText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `
You are ZenMac CPU Diagnostics assistant.
A user has requested dynamic CPU hotspot diagnostics for a process running high on their Mac.
Analyze the following process details and stack trace samples (first 30KB of native macOS 'sample' output):
- Process Name: ${processName}
- PID: ${pid}
- Call Graph / Stack Samples:
"""
${callGraphText}
"""

Instructions:
1. Parse the call graph and identify which libraries, frame symbols, or system frameworks (e.g., IconServices, CoreGraphics, DesktopServicesPriv, WebCore, JavascriptCore, Networking, disk I/O, locks) are active and where the samples/CPU usage is concentrated.
2. Determine exactly what task this process is busy with (e.g., loading directories, rendering graphics, processing web requests, JavaScript garbage collection, file synchronization, DB queries).
3. Offer 1-2 practical, actionable recommendations to resolve or reduce this CPU load (e.g., relaunching Finder, closing specific browser tabs, checking folder file counts, pausing sync agents).

Provide your diagnostics in a structured JSON response matching this schema:
{
  "activity": string (A concise 1-sentence summary of what the process is currently busy with, e.g., "Finder is currently busy updating file event notifications and rendering custom icons for a folder."),
  "explanation": string (A clear 2-3 sentence explanation of the technical findings in the call stack, describing the main libraries/threads causing the hotspot),
  "recommendation": string (Clear, numbered bullet points of actionable advice for the user to mitigate the load)
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonText = response.text();
  
  try {
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error('Error parsing Gemini response:', jsonText);
    throw new Error('Failed to parse AI diagnostics response.');
  }
}

