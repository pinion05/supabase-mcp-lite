# Supabase MCP Lite

Minimal Supabase MCP server - 70% less context usage than standard implementations.

## Why Lite?

- **5 tools instead of 50+** - Only essential operations
- **Minimal descriptions** - No verbose explanations
- **Simple parameters** - No complex nested schemas
- **Auto-truncated results** - Max 100 rows per query

## Setup

1. Add to your MCP client configuration:

```json
{
  "supabase-lite": {
    "command": "npx",
    "args": ["@smithery/cli", "connect", "@pinion05/supabase-mcp-lite"],
    "config": {
      "supabaseUrl": "YOUR_SUPABASE_URL",
      "supabaseKey": "YOUR_SERVICE_ROLE_KEY"
    }
  }
}
```

## Tools (5)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `query` | Run SQL | sql, params? |
| `select` | Get data | table, where?, limit? |
| `mutate` | Change data | action, table, data?, where? |
| `storage` | Files | action, bucket, path?, data? |
| `auth` | Users | action, email?, password?, id? |

## Examples

```sql
-- Query tool
query(sql: "SELECT * FROM users WHERE age > $1", params: [18])

-- Select tool  
select(table: "posts", where: {status: "published"}, limit: 10)

-- Mutate tool
mutate(action: "insert", table: "todos", data: {title: "New task"})
mutate(action: "update", table: "todos", data: {done: true}, where: {id: 1})
mutate(action: "delete", table: "todos", where: {id: 1})

-- Storage tool
storage(action: "upload", bucket: "images", path: "avatar.jpg", data: "base64...")
storage(action: "list", bucket: "images")

-- Auth tool
auth(action: "list")
auth(action: "create", email: "user@example.com", password: "secure123")
```

## License

MIT