# Troubleshooting

Common issues and solutions for CC-Express.

## Authentication Errors

### "Authentication required" (401)

**Cause**: Missing or invalid `Authorization` header.

**Solution**:
```bash
# Include the Bearer token
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  http://localhost:28000/v1/models
```

### "Invalid API key"

**Cause**: `API_SECRET` environment variable not set or doesn't match.

**Solution**:
```bash
# Check your .env file
cat .env | grep API_SECRET

# Ensure the value matches what you're sending
```

### Claude Code Authentication Failed

**Cause**: Invalid or expired Claude Code session.

**Solution**:
```bash
# Re-authenticate Claude Code
claude auth logout
claude auth login

# Or use API key instead
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Server Errors

### "Cannot find module" on startup

**Cause**: Missing build or dependencies.

**Solution**:
```bash
rm -rf node_modules dist
pnpm install
pnpm build
pnpm start
```

### "Port already in use"

**Cause**: Another process is using the port.

**Solution**:
```bash
# Find the process
lsof -i :28000

# Kill it
kill -9 <PID>

# Or use a different port
PORT=28001 pnpm start
```

### "EACCES permission denied"

**Cause**: Insufficient permissions for files or directories.

**Solution**:
```bash
# Fix ownership
sudo chown -R $(whoami) ./workspace

# Docker: ensure correct volume permissions
docker compose down
sudo chown -R $(id -u):$(id -g) ./workspace ~/.claude
docker compose up -d
```

---

## Tool Execution Errors

### "Path does not exist" for tool calls

**Cause**: Claude is using built-in tools instead of client tools, or the path doesn't exist on the server.

**Solution**:
1. Ensure you're sending tools in your request
2. Verify `NO_TOOL_EXECUTION=true` is set
3. Check the logs to see which tools are being used:
   ```bash
   docker compose logs -f | grep "tool"
   ```

### Tool calls not being returned

**Cause**: Configuration issue with tool handling.

**Solution**:
1. Check logs for tool conversion:
   ```bash
   docker compose logs | grep "Converting OpenAI tools"
   ```
2. Verify tools are properly formatted in request
3. Ensure `NO_TOOL_EXECUTION=true`

### Parameter names wrong (snake_case vs camelCase)

**Cause**: This should be handled automatically, but may fail for nested objects.

**Solution**: CC-Express transforms top-level parameters. For nested objects, handle transformation in your client.

---

## Streaming Issues

### Streaming response cuts off

**Cause**: Connection timeout or client disconnect.

**Solution**:
1. Increase client timeout
2. Check for proxy timeouts (nginx, etc.)
3. Verify network stability

### "data: [DONE]" never received

**Cause**: Error during streaming.

**Solution**:
```bash
# Check server logs
docker compose logs -f

# Look for error messages during the request
```

### SSE events not parsing correctly

**Cause**: Client not handling SSE format properly.

**Solution**: Each event is prefixed with `data: ` and ends with `\n\n`:
```
data: {"id":"...","choices":[...]}\n\n
data: [DONE]\n\n
```

---

## Docker Issues

### Container exits immediately

**Cause**: Missing required environment variables or configuration error.

**Solution**:
```bash
# Check exit logs
docker compose logs cc-express

# Common causes:
# - Missing API_SECRET
# - Invalid configuration
```

### "exec format error"

**Cause**: Wrong architecture (e.g., ARM image on x86).

**Solution**:
```bash
# Rebuild for your architecture
docker compose build --no-cache
```

### Health check failing

**Cause**: Server not responding on expected port.

**Solution**:
```bash
# Check if server is running inside container
docker compose exec cc-express wget -q -O- http://localhost:28000/health

# Check port mapping
docker compose ps
```

### Volume mount permission denied

**Cause**: User mismatch between host and container.

**Solution**:
```bash
# Container runs as root, ensure host files are accessible
sudo chown -R root:root ./workspace
# Or make world-readable
chmod -R 755 ./workspace
```

---

## Performance Issues

### Slow response times

**Causes**:
1. Model choice (Opus is slower than Haiku)
2. Large context (many messages)
3. Complex tool operations

**Solutions**:
1. Use `claude-haiku-4-5` for faster responses
2. Reduce conversation history
3. Limit `MAX_TURNS` for client tool scenarios

### High memory usage

**Cause**: Large conversations or many concurrent requests.

**Solution**:
```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

### Connection timeouts

**Cause**: Long-running requests exceeding timeout.

**Solution**:
1. Increase client timeout
2. Use streaming for long responses
3. Reduce `MAX_TURNS`

---

## Logging and Debugging

### Enable verbose logging

Logs are verbose by default. Key log entries:

```bash
# Request received
grep "Incoming chat completion request" logs

# Tool conversion
grep "Converting OpenAI tools" logs

# Tool calls
grep "Tool call intercepted" logs

# Response sent
grep "Streaming complete" logs
```

### Check specific request

```bash
# Filter by completion ID
docker compose logs | grep "chatcmpl-abc123"
```

### Log level adjustment

Currently logs at INFO level. For more detail, modify `src/utils/logger.ts`.

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Request body must be an object` | Invalid JSON | Check request body format |
| `messages must be an array` | Missing/invalid messages | Include messages array |
| `messages array cannot be empty` | Empty messages | Add at least one message |
| `role must be one of: system, user, assistant, tool` | Invalid role | Use valid role string |
| `content must be a string, array, or null` | Invalid content type | Fix message content |
| `Path does not exist` | File/path not found | Check WORKING_DIR or tool path |

---

## Getting Help

1. **Check logs first**: Most issues are visible in logs
2. **Search issues**: Check existing GitHub issues
3. **Create issue**: Include logs, configuration (redact secrets), and steps to reproduce

### Information to Include

```
- CC-Express version: (git commit or version)
- Node.js version: (node --version)
- OS: (uname -a or Windows version)
- Docker version: (docker --version, if applicable)
- Error message: (full error text)
- Logs: (relevant log entries)
- Request: (example request, redact secrets)
- Configuration: (.env values, redact secrets)
```
