import os
import base64
import pickle
import re
import json
from datetime import datetime
import time

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import pandas as pd
import ollama

# ========================== CONFIG ==========================
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
LABEL_ID = "Label_909264579972262874"
EXCEL_FILE = "gerendo_opportunities.xlsx"

OLLAMA_MODEL = "llama3.1"        # Better at following instructions than 3.2

YOUR_CONTEXT = """
Gerendo helps teams with knowledge scattered across Gmail, Slack, WhatsApp, Drive, Notion, Asana, etc.
It solves lost decisions, hard-to-find information, and painful onboarding.
"""

PROMPT_TEMPLATE = """
You are a strict researcher for Gerendo.

Context: {context}

Reddit Post:
Title: {title}
Body: {body}

Only mark as relevant if there is **clear pain** about scattered knowledge, lost information, too many tools, or difficulty finding past decisions.

**IMPORTANT**: Respond with **ONLY** valid JSON. No explanations, no markdown, no extra text.

{{
  "relevant": true or false,
  "score": 1-10,
  "one_line_summary": "short summary",
  "pain_points": "main problems mentioned",
  "why_gerendo_fits": "how Gerendo helps or 'Not a good fit'",
  "suggested_action": "ignore / read / comment / reach_out"
}}

Only "relevant": true if score >= 7 and there is clear pain.
"""

def authenticate_gmail():
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)

    return build('gmail', 'v1', credentials=creds)

# ====================== MAIN ======================
service = authenticate_gmail()
print("✅ Connected to Gmail!")

results = service.users().messages().list(
    userId='me', labelIds=[LABEL_ID], q="is:unread", maxResults=20
).execute()

messages = results.get('messages', [])
print(f"Found {len(messages)} unread emails.\n")

interesting_posts = []

for i, msg in enumerate(messages, 1):
    msg_id = msg['id']
    
    try:
        msg_data = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
        payload = msg_data['payload']
        headers = {h['name']: h['value'] for h in payload['headers']}

        title = headers.get('Subject', 'No Title')
        body = ""

        if 'parts' in payload:
            for part in payload['parts']:
                if part.get('mimeType') == 'text/plain':
                    data = part['body'].get('data')
                    if data:
                        body = base64.urlsafe_b64decode(data).decode('utf-8')
        else:
            data = payload['body'].get('data')
            if data:
                body = base64.urlsafe_b64decode(data).decode('utf-8')

        url_match = re.search(r'https?://(?:www\.)?reddit\.com[^\s<>"]+', body + " " + title)
        url = url_match.group(0) if url_match else ""

        print(f"[{i}/{len(messages)}] Analyzing: {title[:75]}...")

        prompt = PROMPT_TEMPLATE.format(context=YOUR_CONTEXT, title=title, body=body[:4000])

        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[{'role': 'user', 'content': prompt}]
        )

        result_text = response['message']['content'].strip()

        # Aggressive cleaning
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        result_text = result_text.strip()

        result_json = json.loads(result_text)

        if result_json.get("relevant") and result_json.get("score", 0) >= 7:
            interesting_posts.append({
                "Date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "Title": title,
                "Reddit_Post_Link": url,
                "Score": result_json["score"],
                "Summary": result_json["one_line_summary"],
                "Pain_Points": result_json["pain_points"],
                "Why_Gerendo_Fits": result_json["why_gerendo_fits"],
                "Suggested_Action": result_json["suggested_action"]
            })
            print(f"✅ Strong opportunity! (Score: {result_json['score']})")
        else:
            print(f"→ Skipped (Score: {result_json.get('score', 0)})")

    except json.JSONDecodeError:
        print("❌ JSON parsing failed (bad format from Ollama)")
    except Exception as e:
        print(f"❌ Error: {e}")

    # Mark as read
    try:
        service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()
    except:
        pass

    time.sleep(1.5)

# ====================== SAVE TO EXCEL ======================
if interesting_posts:
    new_df = pd.DataFrame(interesting_posts)

    if os.path.exists(EXCEL_FILE):
        existing_df = pd.read_excel(EXCEL_FILE)
        combined_df = pd.concat([existing_df, new_df]).drop_duplicates(subset=['Title'], keep='last')
    else:
        combined_df = new_df

    with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
        combined_df.to_excel(writer, index=False, sheet_name='Opportunities')
        workbook = writer.book
        worksheet = writer.sheets['Opportunities']
        
        for row in range(2, len(combined_df) + 2):
            cell = worksheet[f'C{row}']
            if cell.value and str(cell.value).startswith('http'):
                cell.hyperlink = cell.value
                cell.style = "Hyperlink"

    print(f"\n🎉 Added {len(interesting_posts)} new opportunities to {EXCEL_FILE}")
else:
    print("\nNo strong opportunities found this time.")

print("\n✅ Done!")
