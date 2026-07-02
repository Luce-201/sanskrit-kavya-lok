import pandas as pd
import yaml
import os

# Paste your unique Google Sheet ID here
SHEET_ID = 'YOUR_SHEET_ID_HERE'
URL = f'https://docs.google.com/spreadsheets/d/1igxF5tJp-J6y2dALdD1BwvflzpMhB-hAVLzKtRc5wL4/export?format=csv'

print("Fetching live corpus from Google Sheets...")

try:
    df = pd.read_csv(URL)
    df = df.fillna('') # Clean empty cells

    chapters = df.groupby(['Book_Parent', 'Chapter_Title', 'Chapter_Number'])

    output_dir = 'content/chapters'
    os.makedirs(output_dir, exist_ok=True)

    for (book, title, number), group in chapters:
        frontmatter = {
            "title": str(title),
            "book_parent": str(book),
            "weight": int(number),
            "shlokas": []
        }
        
        for index, row in group.iterrows():
            frontmatter["shlokas"].append({
                "sanskrit": str(row['Sanskrit']).strip(),
                "translation": str(row['Translation']).strip()
            })
        
        filename = f"{book}-sarga-{number}.md"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write('---\n')
            yaml.dump(frontmatter, file, allow_unicode=True, sort_keys=False)
            file.write('---\n')

    print(f"Success! {len(chapters)} chapters have been generated.")

except Exception as e:
    print(f"An error occurred: {e}")