# openschichtplaner5-webserver

[![FastAPI](https://img.shields.io/badge/FastAPI-0.68+-green.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

Web server component for OpenSchichtplaner5 - serves the complete web application including API, frontend dashboard, and static assets.

## 🎯 Overview

The webserver provides a unified entry point for the entire OpenSchichtplaner5 system, combining the REST API with a modern web dashboard for shift planning and analytics.

## 🚀 Quick Start

```bash
# Start the web server
python -m openschichtplaner5_webserver.main \
    --dir /path/to/dbf/files \
    --host 0.0.0.0 \
    --port 8080
```

**Available URLs:**
- `http://localhost:8080/` - Main dashboard
- `http://localhost:8080/schichtplan/dienstplan` - Employee schedule view
- `http://localhost:8080/schichtplan/einsatzplan` - Shift-based view
- `http://localhost:8080/schichtplan/jahresplan` - Annual overview
- `http://localhost:8080/api/docs` - API documentation

## 🏗️ Architecture

The webserver mounts the API as a sub-application and serves static files:

```python
from fastapi import FastAPI
from openschichtplaner5_api.api import create_api

# Main web application
app = FastAPI(title="OpenSchichtplaner5 Web Server")

# Mount API under /api prefix
api_app = create_api(dbf_directory)
app.mount("/api", api_app)

# Serve static files and templates
app.mount("/static", StaticFiles(directory="static"))
```

## 📄 License

This web server is part of the OpenSchichtplaner5 project and is licensed under the MIT License.
