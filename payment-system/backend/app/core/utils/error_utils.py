import traceback


def _project_relative(filename: str) -> str | None:
    """Return the path starting at 'app/...' if the frame is our own code, else None."""
    normalized = filename.replace("\\", "/")
    if "/app/" in normalized:
        return "app/" + normalized.split("/app/", 1)[1]
    return None


def get_root_error(exc: Exception) -> str:
    """One-line summary: exception type, message, and the app/ file:line it came from."""
    tb = traceback.extract_tb(exc.__traceback__)
    if not tb:
        return f"{type(exc).__name__}: {exc}"

    app_frames = [f for f in tb if _project_relative(f.filename)]
    frame = app_frames[-1] if app_frames else tb[-1]
    location = _project_relative(frame.filename) or frame.filename
    return f"{type(exc).__name__}: {exc} ({location}:{frame.lineno})"


def format_app_traceback(exc: Exception) -> str:
    """Multi-line traceback limited to our own app/ frames.

    Skips the FastAPI/Starlette internal frames so the log stays short and
    points straight at the bug instead of dumping the whole call stack.
    """
    tb = traceback.extract_tb(exc.__traceback__)
    app_frames = [f for f in tb if _project_relative(f.filename)]
    frames = app_frames or tb[-1:]

    lines = [f"{type(exc).__name__}: {exc}"]
    for f in frames:
        location = _project_relative(f.filename) or f.filename
        line = f"  {location}:{f.lineno} in {f.name}()"
        if f.line:
            line += f"  ->  {f.line.strip()}"
        lines.append(line)
    return "\n".join(lines)
