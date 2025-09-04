# Supabase MCP Lite

Minimal Supabase MCP server - 70% less context usage than standard implementations.

## Why Lite?

- **4 tools instead of 50+** - Only essential operations  
- **Minimal descriptions** - No verbose explanations
- **Simple parameters** - No complex nested schemas
- **Auto-truncated results** - Max 100 rows per query

## ⚠️ IMPORTANT: Service Role Key Required

This MCP requires a **service role key** (NOT anon key) for full database access:
- **Service role key**: Full access, bypasses RLS, can insert/update/delete
- **Anon key**: Limited access, respects RLS, read-only in most cases

Find your service role key in:
1. Supabase Dashboard → Settings → API
2. Look for "service_role" key (NOT "anon" key)

## Setup

1. Add to your MCP client configuration:

```json
{
  "supabase-lite": {
    "command": "npx",
    "args": ["@smithery/cli", "connect", "@pinion05/supabase-mcp-lite"],
    "config": {
      "supabaseKey": "YOUR_SERVICE_ROLE_KEY"  // ⚠️ Must be service role key!
    }
  }
}
```

**Note**: Project URL is now required per tool call, allowing access to multiple projects.

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

## Security Notes

- Service role key bypasses Row Level Security (RLS)
- Keep your service role key secure - never expose it client-side
- This tool is intended for server-side/admin use only

## License

MIT