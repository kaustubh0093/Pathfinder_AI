def as_markdown(output) -> str:
    """Clean and normalize LLM/agent output to plain markdown string."""
    val = getattr(output, "content", None)
    if val is None:
        val = str(output)
    if not isinstance(val, str):
        val = str(val)
    if val.startswith("content='") or val.startswith('content="'):
        start = 9
        val = val[start:]
        if val.endswith("'") or val.endswith('"'):
            val = val[:-1]
    val = val.replace("\\n", "\n").replace("\r", "")
    while "\n\n\n" in val:
        val = val.replace("\n\n\n", "\n\n")
    return val.strip()
