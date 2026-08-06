import os
import sys
from pathlib import Path

# Ensure project root is in sys.path for Vercel Serverless Function
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sprintpulse.settings')

from django.core.wsgi import get_wsgi_application

# Expose WSGI application for Vercel python handler
application = get_wsgi_application()
app = application
handler = application
