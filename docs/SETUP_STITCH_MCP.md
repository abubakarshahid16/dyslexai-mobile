# Set Up Stitch (StitchAI) with Cursor via MCP

This guide configures **StitchAI's MCP server** (memory/knowledge hub for AI) so Cursor can use it.

## 1. Prerequisites

- **Node.js** (v18+) and **npm** installed
- **Cursor** installed
- (Optional) A Stitch AI API key — leave `API_KEY` empty to use the demo API

## 2. Clone the Stitch AI MCP server

In a terminal, from your project folder:

```powershell
cd c:\Users\NAC\Desktop\MCP_Stitch
git clone https://github.com/StitchAI/stitch-ai-mcp.git
```

## 3. Install dependencies

```powershell
cd stitch-ai-mcp
npm install @modelcontextprotocol/sdk zod
npm install -D @types/node typescript ts-node
npm install
cd ..
```

## 4. Configure Cursor to use the MCP server

Two options:

### Option A: Project-only (this repo)

The file `.cursor/mcp.json` in this project is already set up. It expects the clone to be:

`c:\Users\NAC\Desktop\MCP_Stitch\stitch-ai-mcp`

So after cloning and installing (steps 2–3), Cursor will pick it up when you open this folder.

**Edit `.cursor/mcp.json`** and set your API key if you have one:

```json
"env": {
  "API_KEY": "your-stitch-api-key-here",
  "BASE_URL": "https://api-demo.stitch-ai.co"
}
```

Leave `API_KEY` as `""` to use the demo endpoint.

### Option B: Global (all Cursor projects)

Create or edit:

**Windows:** `%USERPROFILE%\.cursor\mcp.json`  
(e.g. `C:\Users\NAC\.cursor\mcp.json`)

Use a **full path** to the server (no `workspaceFolder`):

```json
{
  "mcpServers": {
    "stitchai": {
      "command": "npx",
      "args": [
        "ts-node",
        "C:\\Users\\NAC\\Desktop\\MCP_Stitch\\stitch-ai-mcp\\src\\server.ts"
      ],
      "env": {
        "API_KEY": "",
        "BASE_URL": "https://api-demo.stitch-ai.co"
      }
    }
  }
}
```

Adjust the path if you cloned somewhere else. Use double backslashes (`\\`) in JSON.

## 5. Restart Cursor

Close and reopen Cursor (or reload the window). Open this project folder so it uses `.cursor/mcp.json`.

## 6. Verify in Cursor

- Open **Cursor Settings → Features → MCP** and confirm **stitchai** is listed.
- In chat, check **Available Tools** for Stitch tools: `create_space`, `delete_space`, `get_all_spaces`, `upload_memory`, `get_memory`, `get_all_memories`.

## Tools provided by StitchAI MCP

| Tool             | Purpose                                      |
|------------------|----------------------------------------------|
| `create_space`   | Create a new memory space                     |
| `delete_space`   | Delete a memory space                         |
| `get_all_spaces` | List all memory spaces                        |
| `upload_memory`  | Upload a memory to a space                    |
| `get_memory`     | Get one memory by ID                          |
| `get_all_memories` | List/filter memories in a space           |

## Troubleshooting

- **Server not listed:** Ensure `stitch-ai-mcp` is cloned and dependencies are installed; path in `mcp.json` must match your folder.
- **Path errors on Windows:** In global `mcp.json` use `C:\\Users\\NAC\\...` (double backslashes). In project `mcp.json`, `${workspaceFolder}` is resolved by Cursor.
- **ts-node not found:** From `stitch-ai-mcp` run `npm install -D ts-node` and ensure `npx` works in the same terminal you use to launch Cursor.

## Reference

- [StitchAI MCP (GitHub)](https://github.com/StitchAI/stitch-ai-mcp)
- [Cursor MCP docs](https://cursor.com/docs/context/mcp)
