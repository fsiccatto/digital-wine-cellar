from app.services.sheets_service import ensure_required_tabs, get_spreadsheet


if __name__ == "__main__":
    spreadsheet = ensure_required_tabs()
    print({
        "spreadsheet": spreadsheet.title,
        "worksheets": [worksheet.title for worksheet in spreadsheet.worksheets()],
    })
    print(get_spreadsheet().title)
