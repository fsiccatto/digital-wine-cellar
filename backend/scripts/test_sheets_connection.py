import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.sheets_service import (  # noqa: E402
    get_catas_worksheet,
    get_inventory_worksheet,
    get_spreadsheet,
)


if __name__ == "__main__":
    spreadsheet = get_spreadsheet()
    get_inventory_worksheet()
    get_catas_worksheet()
    print({
        "spreadsheet": spreadsheet.title,
        "worksheets": [worksheet.title for worksheet in spreadsheet.worksheets()],
    })
