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
        for index, row in group.iterrows():
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

except Exception as e:
    print(f"An error occurred: {e}")