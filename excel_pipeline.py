import pandas as pd
import yaml
import os
import sys

# Paste your unique Google Sheet ID here
SHEET_ID = '1igxF5tJp-J6y2dALdD1BwvflzpMhB-hAVLzKtRc5wL4'

# Each TAB in a Google Sheet needs its own export URL with a "gid" parameter.
# Find the gid by opening that tab in your browser and looking at the URL:
#   .../edit#gid=123456789
# gid=0 is usually the first/default tab.
CHAPTERS_GID = '0'                 # <-- replace with your Chapters tab's gid if not the first tab
POETS_GID = '1541199176'  # <-- replace with your Poets tab's gid

CHAPTERS_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={CHAPTERS_GID}'
POETS_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={POETS_GID}'


def slugify(name):
    """Turn a poet's name into a safe filename, e.g. 'Kalidasa' -> 'kalidasa'."""
    s = str(name).strip().lower()
    s = s.replace(' ', '-')
    safe = []
    for ch in s:
        if ch.isalnum() or ch == '-':
            safe.append(ch)
    return ''.join(safe) or 'unnamed-poet'


def process_chapters():
    print("Fetching chapters/shlokas from Google Sheets...")
    df = pd.read_csv(CHAPTERS_URL)
    df = df.fillna('')  # Clean empty cells

    # Group the rows by Book, Chapter Title, and Chapter Number
    chapters = df.groupby(['Book_Parent', 'Chapter_Title', 'Chapter_Number'])

    for (book, title, number), group in chapters:
        # 1. DYNAMIC ROUTING: Create the specific folder for this book!
        # This will create content/books/kumarasambhavam or content/books/raghuvamsham automatically
        output_dir = os.path.join('content', 'books', str(book))
        os.makedirs(output_dir, exist_ok=True)

        # 2. Automatically generate the _index.md file for the book if it's missing
        index_path = os.path.join(output_dir, '_index.md')
        if not os.path.exists(index_path):
            with open(index_path, 'w', encoding='utf-8') as idx_file:
                # We can refine this later, but this ensures the folder never 404s
                idx_file.write(f'---\ntitle: "{str(book).title()}"\nlayout: list\n---\n')

        # 3. Build the Chapter YAML Frontmatter
        frontmatter = {
            "title": str(title),
            "book_parent": str(book),
            "weight": int(number),
            "shlokas": []
        }

        # Add the shlokas
        for _, row in group.iterrows():
            frontmatter["shlokas"].append({
                "sanskrit": str(row['Sanskrit']).strip(),
                "translation": str(row['Translation']).strip()
            })

        # 4. Save the Chapter Markdown file INSIDE the dynamic book folder
        filename = f"sarga-{number}.md"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write('---\n')
            yaml.dump(frontmatter, file, allow_unicode=True, sort_keys=False)
            file.write('---\n')

    print(f"Success! {len(chapters)} chapters have been dynamically routed.")


def read_existing_poet_md(filepath):
    """
    Read an existing poet .md file and split it into (frontmatter_dict, body_text).
    Returns ({}, '') if the file doesn't exist or can't be parsed.
    """
    if not os.path.exists(filepath):
        return {}, ''

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Frontmatter is delimited by '---' at the start and a matching '---' after it
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content.strip()

    _, fm_text, body_text = parts
    try:
        frontmatter = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        frontmatter = {}

    return frontmatter, body_text.strip()


def process_poets():
    print("Fetching poets from Google Sheets...")
    df = pd.read_csv(POETS_URL)
    df = df.fillna('')  # Clean empty cells

    output_dir = os.path.join('content', 'poets')
    os.makedirs(output_dir, exist_ok=True)

    # Sheet column -> frontmatter field
    FIELD_MAP = {
        "title_en": "title_en",
        "dates": "dates",
        "region": "region",
        "image_url": "image",
    }

    count = 0
    for _, row in df.iterrows():
        name = str(row.get('name', '')).strip()
        if not name:
            continue  # skip blank rows

        slug = slugify(name)
        filepath = os.path.join(output_dir, f"{slug}.md")

        # Load whatever's already on disk (could be from a previous sheet run,
        # or hand-edited via Pages CMS) so we don't clobber it wholesale.
        existing_frontmatter, existing_body = read_existing_poet_md(filepath)

        frontmatter = dict(existing_frontmatter)  # start from what's already there
        frontmatter["title"] = name  # name is always sheet-controlled (it's the key)

        for sheet_col, fm_field in FIELD_MAP.items():
            value = str(row.get(sheet_col, '')).strip()
            if value:  # only overwrite if the sheet cell is non-empty
                frontmatter[fm_field] = value

        sheet_bio = str(row.get('bio', '')).strip()
        body = sheet_bio if sheet_bio else existing_body

        with open(filepath, 'w', encoding='utf-8') as file:
            file.write('---\n')
            yaml.dump(frontmatter, file, allow_unicode=True, sort_keys=False)
            file.write('---\n')
            if body:
                file.write(body + '\n')

        count += 1

    print(f"Success! {count} poets have been synced.")


try:
    process_chapters()
    process_poets()
except Exception as e:
    print(f"An error occurred: {e}")
    sys.exit(1)  # fail the Netlify build loudly instead of shipping stale content