# Supabase MCP Lite
<img width="518" height="141" alt="image" src="https://github.com/user-attachments/assets/04193768-632c-4e32-93d2-291158c804b5" />

Minimal Supabase MCP server - 70% less context usage than standard implementations.

## Why Lite?

- **4 tools instead of 50+** - Only essential operations  
- **Minimal descriptions** - No verbose explanations
- **Simple parameters** - No complex nested schemas
- **Auto-truncated results** - Max 100 rows per query

## 🔑 Personal Access Token Required

This MCP uses your **Supabase Personal Access Token** (starts with `sbp_`) to automatically fetch service role keys for any project you own.

### How to get your Personal Access Token:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate New Token"
3. Give it a name (e.g., "MCP Access")
4. Copy the token (starts with `sbp_`)
5. **Save it securely** - you won't be able to see it again!

## Setup

1. Add to your MCP client configuration:

```json
{
  "supabase-lite": {
    "command": "npx",
    "args": ["@smithery/cli", "connect", "@pinion05/supabase-mcp-lite"],
    "config": {
      "accessToken": "sbp_xxxxxxxxxxxx"  // Your Personal Access Token
    }
  }
}
```

**Note**: Project URL is required for each tool call. The service role key will be fetched automatically using your access token.

## Tools (4)

All tools require `projectUrl` as the first parameter.

| Tool | Purpose | Parameters |
|------|---------|------------|
| `select` | Get data | projectUrl, table, where?, limit? |
| `mutate` | Change data | projectUrl, action, table, data?, where? |
| `storage` | Files | projectUrl, action, bucket, path?, data? |
| `auth` | Users | projectUrl, action, email?, password?, id? |

## Examples

```javascript
// Select tool  
select(
  projectUrl: "https://your-project.supabase.co",
  table: "posts", 
  where: {status: "published"}, 
  limit: 10
)

// Mutate tool
mutate(
  projectUrl: "https://your-project.supabase.co",
  action: "insert", 
  table: "todos", 
  data: {title: "New task"}
)
mutate(
  projectUrl: "https://your-project.supabase.co",
  action: "update", 
  table: "todos", 
  data: {done: true}, 
  where: {id: 1}
)
mutate(
  projectUrl: "https://your-project.supabase.co",
  action: "delete", 
  table: "todos", 
  where: {id: 1}
)

// Storage tool
storage(
  projectUrl: "https://your-project.supabase.co",
  action: "upload", 
  bucket: "images", 
  path: "avatar.jpg", 
  data: "base64..."
)
storage(
  projectUrl: "https://your-project.supabase.co",
  action: "list", 
  bucket: "images"
)

// Auth tool
auth(
  projectUrl: "https://your-project.supabase.co",
  action: "list"
)
auth(
  projectUrl: "https://your-project.supabase.co",
  action: "create", 
  email: "user@example.com", 
  password: "secure123"
)
```

## How it Works

1. You provide your Personal Access Token (`sbp_xxx`)
2. When you call a tool with a project URL, the MCP:
   - Extracts the project ID from the URL
   - Uses your access token to fetch the service role key via Supabase Management API
   - Caches the key for future requests to the same project
   - Creates a client with full admin access

## Security Notes

- Personal Access Token gives access to ALL your Supabase projects
- Service role keys are fetched automatically and cached in memory
- Service role key bypasses Row Level Security (RLS)
- Keep your access token secure - never expose it client-side
- This tool is intended for server-side/admin use only

## Features

- ✅ Works with any Supabase project you own
- ✅ Automatic service role key retrieval
- ✅ Key caching to minimize API calls
- ✅ Full database access (bypasses RLS)
- ✅ Support for multiple projects in one session

## License

MIT
