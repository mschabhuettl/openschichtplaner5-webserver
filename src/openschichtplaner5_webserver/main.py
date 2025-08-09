"""
OpenSchichtplaner5 Web Server
Main entry point for the web server that launches the API.
"""

import sys
import uvicorn
import argparse
from pathlib import Path

# Add paths for all submodules
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root / "libopenschichtplaner5" / "src"))
sys.path.insert(0, str(project_root / "openschichtplaner5-api" / "src"))

from openschichtplaner5_api.api import create_api
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request


def main():
    """Main entry point for the web server."""
    parser = argparse.ArgumentParser(description="OpenSchichtplaner5 Web Server")
    parser.add_argument("--dir", required=True, help="DBF directory path", type=Path)
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes")
    parser.add_argument("--log-level", default="info", help="Log level")

    args = parser.parse_args()

    # Validate DBF directory
    if not args.dir.exists() or not args.dir.is_dir():
        print(f"Error: DBF directory {args.dir} does not exist or is not a directory")
        sys.exit(1)

    print(f"Starting OpenSchichtplaner5 Web Server...")
    print(f"DBF Directory: {args.dir}")
    print(f"Server: http://{args.host}:{args.port}")
    print(f"Workers: {args.workers}")
    print(f"Reload: {args.reload}")

    # Create main FastAPI app for the webserver
    from fastapi import FastAPI
    app = FastAPI(title="OpenSchichtplaner5 Web Server", version="1.0.0")
    
    # Create API sub-app
    api_app = create_api(args.dir, title="OpenSchichtplaner5 API", version="1.0.0")
    
    # Mount API under /api prefix
    app.mount("/api", api_app)
    
    # Add static files and templates
    webserver_path = project_root / "openschichtplaner5-webserver"
    static_path = webserver_path / "static"
    templates_path = webserver_path / "templates"
    
    # Mount static files
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
    
    # Setup templates
    templates = Jinja2Templates(directory=str(templates_path))
    
    # Frontend routes
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def frontend_root(request: Request):
        """Serve the main dashboard page at root."""
        return templates.TemplateResponse("index.html", {"request": request})
    
    @app.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
    async def dashboard_alias(request: Request):
        """Dashboard alias route."""
        return templates.TemplateResponse("index.html", {"request": request})
    
    # New structured routing system under /schichtplan
    @app.get("/schichtplan", response_class=HTMLResponse, include_in_schema=False)
    async def schichtplan_overview(request: Request):
        """Main schedule overview page."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule"})
    
    @app.get("/schichtplan/dienstplan", response_class=HTMLResponse, include_in_schema=False)
    async def schichtplan_dienstplan(request: Request):
        """Employee-based schedule view (Dienstplan)."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "dienstplan"})
    
    @app.get("/schichtplan/einsatzplan", response_class=HTMLResponse, include_in_schema=False)
    async def schichtplan_einsatzplan(request: Request):
        """Shift-based schedule view (Einsatzplan)."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "einsatzplan"})
    
    @app.get("/schichtplan/jahresplan", response_class=HTMLResponse, include_in_schema=False)
    async def schichtplan_jahresplan(request: Request):
        """Annual schedule view (Jahresplan)."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "jahresuebersicht"})
    
    # Legacy routes (keep for backward compatibility)
    @app.get("/dienstplan", response_class=HTMLResponse, include_in_schema=False)
    async def dienstplan_page(request: Request):
        """Legacy Dienstplan page - redirects to new structure."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "dienstplan"})
    
    @app.get("/einsatzplan", response_class=HTMLResponse, include_in_schema=False)
    async def einsatzplan_page(request: Request):
        """Legacy Einsatzplan page - redirects to new structure."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "einsatzplan"})
    
    @app.get("/jahresuebersicht", response_class=HTMLResponse, include_in_schema=False)
    async def jahresuebersicht_page(request: Request):
        """Legacy Jahresübersicht page - redirects to new structure."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "schedule", "default_view": "jahresuebersicht"})
    
    # Analytics and reporting routes
    @app.get("/analytics", response_class=HTMLResponse, include_in_schema=False)
    async def analytics_page(request: Request):
        """Analytics dashboard page."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "analytics"})
    
    @app.get("/mitarbeiter", response_class=HTMLResponse, include_in_schema=False)
    async def mitarbeiter_page(request: Request):
        """Employee management page."""
        return templates.TemplateResponse("index.html", {"request": request, "default_tab": "employees"})
    
    # Utility routes (none currently defined)

    # Run the server
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,  # Workers and reload don't work together
        log_level=args.log_level
    )


if __name__ == "__main__":
    main()