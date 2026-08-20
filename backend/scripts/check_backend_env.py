import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / '.env'
CREDENTIALS_FILE = BASE_DIR / 'credentials.json'


def load_dotenv_file(path: Path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip()
    return values


def main():
    env_values = load_dotenv_file(ENV_FILE)
    print('=== Estado de configuración ===')

    gemini_key = env_values.get('GEMINI_API_KEY', '').strip()
    sheet_name = env_values.get('GOOGLE_SHEET_NAME', '').strip()
    credentials_path = env_values.get('GOOGLE_SHEETS_CREDENTIALS_FILE', 'credentials.json').strip()

    print(f'ENV file: {ENV_FILE.exists()}')
    print(f'Gemini key present: {bool(gemini_key and gemini_key != "your_gemini_api_key_here")}')
    print(f'Sheet name: {sheet_name or "missing"}')
    print(f'Credentials file path: {credentials_path}')
    print(f'Credentials file exists: {Path(BASE_DIR / credentials_path).exists()}')

    if not gemini_key or gemini_key == 'your_gemini_api_key_here':
        print('\nFalta configurar GEMINI_API_KEY real en backend/.env')
    if not Path(BASE_DIR / credentials_path).exists():
        print('\nFalta el archivo credentials.json del Service Account en backend/')
    if not sheet_name:
        print('\nFalta GOOGLE_SHEET_NAME en backend/.env')


if __name__ == '__main__':
    main()
